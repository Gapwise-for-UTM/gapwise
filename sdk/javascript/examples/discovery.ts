import { Gapwise } from "@gapwise/sdk";
const gapwise = new Gapwise();
const page = await gapwise.places.list({ building: "HM", kind: "library" });
for (const place of page.data) {
  const source = place.metadataProvenance;
  console.log(
    `${place.name}: ${place.availability.state} (${source.status}, observed ${source.observedAt})`,
  );
}
