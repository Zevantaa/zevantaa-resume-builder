type IconProps = { className?: string };

export function ArrowUpIcon({ className }: IconProps) {
  return <svg aria-hidden="true" className={className} fill="none" focusable="false"
    viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" stroke="currentColor" strokeLinecap="round"
      strokeLinejoin="round" strokeWidth="2" />
  </svg>;
}

export function ArrowRightIcon({ className }: IconProps) {
  return <svg aria-hidden="true" className={className} fill="none" focusable="false"
    viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 12h14m-5.5-5.5L19 12l-5.5 5.5" stroke="currentColor" strokeLinecap="round"
      strokeLinejoin="round" strokeWidth="2" />
  </svg>;
}
