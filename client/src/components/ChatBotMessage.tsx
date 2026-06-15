import { Link } from 'react-router-dom';
import { decodeHtmlEntities } from '@utils/html';
import { normalizeMapLink } from '@utils/mapGuide';

const MAP_LINK_RE = /(\*\*[^*]+\*\*|\/(?:map(?:\/guide)?|navigate)\?[^\s]+)/g;

/** Render bot text with bold and clickable campus map links */
export default function ChatBotMessage({ text }: { text: string }) {
  const decoded = decodeHtmlEntities(text);
  const parts = decoded.split(MAP_LINK_RE);

  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-semibold">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (
          part.startsWith('/map?') ||
          part.startsWith('/map/guide?') ||
          part.startsWith('/navigate?')
        ) {
          const to = normalizeMapLink(part);
          const isTodayAll = to.includes('today=1');
          return (
            <Link
              key={i}
              to={to}
              className="font-semibold text-[var(--color-primary)] underline hover:no-underline"
            >
              {isTodayAll ? "Guide all today's classes" : 'View directions'}
            </Link>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
