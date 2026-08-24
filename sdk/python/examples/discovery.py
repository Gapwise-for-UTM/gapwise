from gapwise import Gapwise

with Gapwise() as gapwise:
    page = gapwise.places.list(building="HM", kind="library")
    for place in page.items:
        provenance = place["metadataProvenance"]
        print(place["name"], place["availability"]["state"], provenance["status"])
