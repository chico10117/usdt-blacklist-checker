import type { Metadata } from "next";

import { ReportDetailClient } from "./report-detail-client";

export const metadata: Metadata = {
  title: "Report",
};

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <ReportDetailClient reportId={id} />
    </div>
  );
}
