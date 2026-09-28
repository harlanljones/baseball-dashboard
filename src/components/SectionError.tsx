export default function SectionError({ label }: { label: string }) {
  return (
    <p className="rounded-md border border-clay/40 bg-clay/10 px-3 py-2 text-sm text-clay-deep">
      Couldn’t load {label} right now.
    </p>
  );
}
