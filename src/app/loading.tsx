import PageContainer from "@/components/PageContainer";

export default function Loading() {
  return (
    <PageContainer>
      <div className="mb-5 h-10 w-40 animate-pulse rounded bg-ink/10" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-md border border-ink/10 bg-card"
          />
        ))}
      </div>
    </PageContainer>
  );
}
