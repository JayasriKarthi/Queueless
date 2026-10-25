import { useInView } from '../../hooks/useInView';
import { cx } from '../../lib/cx';

// Subtle fade-up when a section scrolls into view.
export default function Reveal({ as: Tag = 'div', className, delay = 0, children, ...rest }) {
  const [ref, inView] = useInView();
  return (
    <Tag ref={ref} className={cx(inView ? 'animate-fade-up' : 'opacity-0', className)} style={{ animationDelay: `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  );
}
