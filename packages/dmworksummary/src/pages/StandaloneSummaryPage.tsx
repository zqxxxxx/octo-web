import React from "react";
import { Button, Empty } from "@douyinfe/semi-ui";
import { t } from "@octo/base";
import SummaryDetailPage from "./SummaryDetailPage";

interface StandaloneSummaryPageProps {
  taskId: number | null;
  spaceId: string | null;
}

/**
 * Full-window landing surface for server-authored Summary card deep links.
 * The authenticated happy path deliberately reuses SummaryDetailPage so card,
 * list, and direct-link entry points share permissions, loading/error states,
 * and the same production UI.
 */
export default function StandaloneSummaryPage({
  taskId,
  spaceId,
}: StandaloneSummaryPageProps) {
  if (taskId == null || spaceId == null) {
    return (
      <main
        className="summary-standalone-terminal"
        aria-labelledby="summary-invalid-link-title"
      >
        <Empty
          title={
            <span id="summary-invalid-link-title">
              {t("summary.deepLink.invalidTitle")}
            </span>
          }
          description={t("summary.deepLink.invalidDescription")}
        >
          <Button theme="solid" onClick={() => window.location.assign("/")}>
            {t("summary.deepLink.backHome")}
          </Button>
        </Empty>
      </main>
    );
  }

  return (
    <main className="summary-standalone-page">
      <SummaryDetailPage taskId={taskId} />
    </main>
  );
}
