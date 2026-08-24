from gapwise import Gapwise, GapwiseAPIError

with Gapwise() as gapwise:
    try:
        plan = gapwise.gaps.plan(
            from_building="MN",
            to_building="IB",
            term="Fall",
            weekday="Wednesday",
            start_time=660,
            end_time=780,
        )
        print(plan["assessment"]["primary"]["title"])
    except GapwiseAPIError as error:
        if error.code == "rate_limited":
            print("Retry later; request:", error.request_id)
        else:
            raise
