from gapwise import Gapwise

with Gapwise() as gapwise:
    print(gapwise.buildings.get("MN"))
    print(gapwise.routes.calculate(from_building="MN", to_building="IB"))
