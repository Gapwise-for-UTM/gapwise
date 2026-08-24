import { Gapwise } from "@gapwise/sdk";
const gapwise = new Gapwise();
console.log(await gapwise.buildings.get("MN"));
console.log(await gapwise.routes.calculate({ from: "MN", to: "IB" }));
