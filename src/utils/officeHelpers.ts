/** Safe wrapper for Excel.run with error logging */
export async function excelRun<T>(
  action: (context: Excel.RequestContext) => Promise<T>
): Promise<T> {
  return Excel.run(async (context) => {
    const result = await action(context);
    await context.sync();
    return result;
  });
}

/** Get current workbook ID (URL-based, falls back to a stored GUID) */
export function getWorkbookId(): string {
  try {
    const url = (Office.context.document as any).url as string | undefined;
    if (url) return url;
  } catch {
    // not available in all hosts
  }
  const stored = localStorage.getItem("datasnipper_workbook_id");
  if (stored) return stored;
  const newId = crypto.randomUUID();
  localStorage.setItem("datasnipper_workbook_id", newId);
  return newId;
}

/** Get current user email if available */
export function getCurrentUserId(): string | undefined {
  try {
    return (Office.context as any).mailbox?.userProfile?.emailAddress as
      | string
      | undefined;
  } catch {
    return undefined;
  }
}
