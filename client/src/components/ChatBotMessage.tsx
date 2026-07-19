import { Link } from 'react-router-dom';
import { decodeHtmlEntities } from '@utils/html';
import { normalizeMapLink } from '@utils/mapGuide';

const TOKEN_RE =
  /(\*\*[^*]+\*\*|\/(?:map(?:\/guide)?|navigate)\?[^\s]+|\/navigate(?![/\w])|\/halls\/availability(?:\?[^\s]*)?|\/appointments\/book\/[A-Za-z0-9_-]+(?:\?[^\s]*)?|\/appointments(?:\?[^\s]*)?)/g;

const CTA_CLASS =
  'mt-1.5 inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold text-white no-underline [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]';

interface ChatBotMessageProps {
  text: string;
  /** Close the chat widget when the user follows an in-app link */
  onNavigateAway?: () => void;
}

/** Render bot text with bold, map links, and booking CTAs */
export default function ChatBotMessage({ text, onNavigateAway }: ChatBotMessageProps) {
  const decoded = decodeHtmlEntities(text);
  const parts = decoded.split(TOKEN_RE);

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
          part.startsWith('/navigate')
        ) {
          const to = part.startsWith('/navigate') ? part : normalizeMapLink(part);
          const isTodayAll = to.includes('today=1');
          const isFindMyWay = to.startsWith('/navigate');
          return (
            <Link
              key={i}
              to={to}
              onClick={() => onNavigateAway?.()}
              className={
                isFindMyWay
                  ? CTA_CLASS
                  : 'font-semibold text-[var(--color-primary)] underline hover:no-underline'
              }
            >
              {isTodayAll
                ? "Guide all today's classes"
                : isFindMyWay
                  ? 'Open Find My Way'
                  : 'View directions'}
            </Link>
          );
        }
        if (part.startsWith('/halls/availability')) {
          return (
            <Link
              key={i}
              to={part}
              onClick={() => onNavigateAway?.()}
              className={CTA_CLASS}
            >
              Book this hall
            </Link>
          );
        }
        if (part.startsWith('/appointments/book/')) {
          return (
            <Link
              key={i}
              to={part}
              onClick={() => onNavigateAway?.()}
              className={CTA_CLASS}
            >
              Book appointment
            </Link>
          );
        }
        if (part === '/appointments' || part.startsWith('/appointments?')) {
          return (
            <Link
              key={i}
              to={part}
              onClick={() => onNavigateAway?.()}
              className={CTA_CLASS}
            >
              Open appointments
            </Link>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
