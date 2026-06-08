export function generateStaticParams() {
  return [{ year: "2026" }];
}

export default function YearLayout({ children }: { children: React.ReactNode }) {
  return children;
}
