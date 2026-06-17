import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { publishedFloorPlanFilter } from '../utils/floorPlanPublish';
import { searchMapEntities } from '../services/mapSearchService';

export interface MapSearchResult {
  kind: 'building' | 'hall' | 'office' | 'marker';
  id: string;
  label: string;
  sublabel?: string;
  latitude: number;
  longitude: number;
  buildingId?: string;
  floor?: number;
  markerId?: string;
  hallId?: string;
  officeId?: string;
  lecturerId?: string;
}

/** Search map entities by building name, hall name, room label, lecturer name */
export async function searchMap(req: Request, res: Response, next: NextFunction) {
  try {
    const q = ((req.query.q as string) || '').trim();
    if (q.length < 2) {
      return res.json({ success: true, data: [] });
    }

    const results: MapSearchResult[] = await searchMapEntities(q);

    // Offices + lecturers when no room/hall marker match
    if (!results.some((r) => r.kind === 'marker' || r.kind === 'hall')) {
      const offices = await prisma.lecturerOffice.findMany({
        where: {
          OR: [
            { roomNumber: { contains: q, mode: 'insensitive' } },
            {
              lecturer: {
                OR: [
                  { firstName: { contains: q, mode: 'insensitive' } },
                  { lastName: { contains: q, mode: 'insensitive' } },
                ],
              },
            },
          ],
        },
        include: {
          lecturer: { select: { id: true, firstName: true, lastName: true } },
        },
        take: 10,
      });

      const officeIds = offices.map((o) => o.id);
      const officeMarkers =
        officeIds.length > 0
          ? await prisma.mapMarker.findMany({
              where: { officeId: { in: officeIds } },
              include: { building: { select: { id: true, name: true, latitude: true, longitude: true } } },
            })
          : [];

      for (const m of officeMarkers) {
        if (!m.officeId || !m.building) continue;
        const office = offices.find((o) => o.id === m.officeId);
        if (!office) continue;

        const lat = m.building.latitude + ((m.y - 50) * 0.00003);
        const lng = m.building.longitude + ((m.x - 50) * 0.00003);

        results.push({
          kind: 'office',
          id: office.id,
          label: `Room ${office.roomNumber}`,
          sublabel: `${office.lecturer.firstName} ${office.lecturer.lastName} • ${m.building.name}`,
          latitude: lat,
          longitude: lng,
          buildingId: m.building.id,
          floor: m.floor,
          markerId: m.id,
          lecturerId: office.lecturer.id,
        });
      }
    }

    res.json({ success: true, data: results.slice(0, 15) });
  } catch (err) {
    next(err);
  }
}

/** Live status for halls and offices (for map markers) */
export async function getMapLiveStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const availableNow = await findAvailableNow();
    const freeHallIds = new Set(availableNow.map((r) => r.hall.id));

    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const currentDay = dayNames[new Date().getDay()];
    const now = new Date();
    const nowStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const hallStatus: Record<
      string,
      { free: boolean; nextSlot?: { startTime: string; endTime: string } }
    > = {};

    for (const r of availableNow) {
      hallStatus[r.hall.id] = {
        free: true,
        nextSlot: r.matchingFreeSlots[0]
          ? { startTime: r.matchingFreeSlots[0].startTime, endTime: r.matchingFreeSlots[0].endTime }
          : undefined,
      };
    }

    const hallMarkers = await prisma.mapMarker.findMany({
      where: { hallId: { not: null } },
      select: { hallId: true },
    });
    const allHallIds = [...new Set(hallMarkers.map((m) => m.hallId).filter(Boolean) as string[])];
    for (const hid of allHallIds) {
      if (hallStatus[hid]) continue;
      try {
        const schedule = await getHallDaySchedule(hid, currentDay);
        const next = schedule.freeSlots.find(
          (s) => s.startTime > nowStr || (s.startTime <= nowStr && s.endTime > nowStr)
        );
        hallStatus[hid] = {
          free: false,
          nextSlot: next ? { startTime: next.startTime, endTime: next.endTime } : undefined,
        };
      } catch {
        hallStatus[hid] = { free: false };
      }
    }

    const offices = await prisma.lecturerOffice.findMany({
      select: { id: true, lecturerId: true },
    });
    const lecturerIds = offices.map((o) => o.lecturerId);

    const nowDate = new Date();
    const windowStart = new Date(nowDate);
    windowStart.setMinutes(windowStart.getMinutes() - 5);
    const windowEnd = new Date(nowDate);
    windowEnd.setMinutes(windowEnd.getMinutes() + 5);

    const overlappingAppts =
      lecturerIds.length > 0
        ? (
            await prisma.appointment.findMany({
              where: {
                lecturerId: { in: lecturerIds },
                status: { in: ['ACCEPTED', 'SCHEDULED', 'PENDING'] },
                dateTime: { lte: windowEnd },
              },
              select: { lecturerId: true, dateTime: true, duration: true },
            })
          ).filter((a) => {
            const start = new Date(a.dateTime);
            const end = new Date(a.dateTime);
            end.setMinutes(end.getMinutes() + a.duration);
            return start <= nowDate && end > nowDate;
          })
        : [];
    const busySet = new Set(overlappingAppts.map((a) => a.lecturerId));

    const officeStatus: Record<string, { available: boolean }> = {};
    for (const o of offices) {
      officeStatus[o.id] = { available: !busySet.has(o.lecturerId) };
    }

    res.json({
      success: true,
      data: { hallStatus, officeStatus },
      meta: { checkedAt: new Date().toISOString() },
    });
  } catch (err) {
    next(err);
  }
}

/** List buildings for map (any authenticated user) */
export async function listMapBuildings(req: Request, res: Response, next: NextFunction) {
  try {
    const isAdmin = req.user?.role === 'ADMIN';
    const data = await prisma.mapBuilding.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        latitude: true,
        longitude: true,
        floors: true,
        _count: { select: { markers: true, floorPlans: true } },
        floorPlans: {
          where: isAdmin ? undefined : publishedFloorPlanFilter(),
          select: {
            id: true,
            floor: true,
            imagePath: true,
            bounds: true,
            drawableRegion: true,
            ...(isAdmin ? { publishStatus: true } : {}),
          },
          orderBy: { floor: 'asc' as const },
        },
      },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

/** List markers for map (any authenticated user) */
export async function listMapMarkers(req: Request, res: Response, next: NextFunction) {
  try {
    const { buildingId, floor, type } = req.query as Record<string, string>;
    const isAdmin = req.user?.role === 'ADMIN';
    const where: Record<string, unknown> = {};
    if (buildingId) where.buildingId = buildingId;
    if (floor) where.floor = parseInt(floor, 10);
    if (type) {
      const types = type.split(',').map((t) => t.trim()).filter(Boolean);
      if (types.length === 1) where.type = types[0];
      else if (types.length > 1) where.type = { in: types };
    }

    if (!isAdmin && buildingId) {
      const published = await prisma.floorPlan.findMany({
        where: { buildingId, ...publishedFloorPlanFilter() },
        select: { floor: true },
      });
      const floors = published.map((p) => p.floor);
      if (floor) {
        const f = parseInt(floor, 10);
        if (!floors.includes(f)) {
          return res.json({ success: true, data: [] });
        }
      } else if (floors.length > 0) {
        where.floor = { in: floors };
      } else {
        return res.json({ success: true, data: [] });
      }
    }

    const data = await prisma.mapMarker.findMany({
      where,
      include: {
        building: { select: { id: true, name: true, code: true, latitude: true, longitude: true } },
        hall: { select: { id: true, name: true } },
        office: {
          select: {
            id: true,
            roomNumber: true,
            lecturer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                department: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: [{ building: { name: 'asc' } }, { floor: 'asc' }, { label: 'asc' }],
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
