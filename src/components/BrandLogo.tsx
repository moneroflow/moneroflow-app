import { Hexagon } from 'lucide-react';
import { Link } from 'react-router-dom';

export const MoneroLogo = ({ className = '', size = 24 }: { className?: string; size?: number }) => (
  <div className={`relative inline-flex items-center justify-center ${className}`}>
    <Hexagon size={size} className="text-primary fill-primary/10" strokeWidth={1.5} />
    <span className="absolute text-primary font-bold" style={{ fontSize: size * 0.35 }}>M</span>
  </div>
);

export const BrandLogo = ({ collapsed = false, linkTo }: { collapsed?: boolean; linkTo?: string }) => {
  const content = (
    <div className="flex items-center gap-2.5">
      <MoneroLogo size={32} />
      {!collapsed && (
        <span className="text-lg font-bold tracking-tight text-foreground">
          Monero<span className="text-primary">Flow</span>
        </span>
      )}
    </div>
  );

  if (linkTo) {
    return <Link to={linkTo}>{content}</Link>;
  }

  return content;
};
