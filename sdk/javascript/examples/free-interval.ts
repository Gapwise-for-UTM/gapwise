import { Gapwise, GapwiseApiError } from "@gapwise/sdk";
const gapwise = new Gapwise();
try {
  const plan = await gapwise.gaps.plan({
    from: "MN",
    to: "IB",
    term: "Fall",
    weekday: "Wednesday",
    startTime: 660,
    endTime: 780,
  });
  console.log(plan.assessment.primary.title, plan.assessment.confidenceLabel);
} catch (error) {
  if (error instanceof GapwiseApiError && error.code === "rate_limited")
    console.error("Retry later", error.requestId);
  else throw error;
}
