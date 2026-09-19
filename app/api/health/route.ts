import { NextResponse } from "next/server";
export async function GET(){
  return NextResponse.json({
    ok: true,
    service: "ffs-mission-control",
    product: "F&P Studio",
    phase: "phase-1-campaign-core",
    autonomousExecution: false
  });
}
