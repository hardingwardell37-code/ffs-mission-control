import { NextResponse } from "next/server";
export async function GET(){return NextResponse.json({ok:true, service:"ffs-mission-control", phase:"governed-registry", autonomousExecution:false});}
