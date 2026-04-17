import type { UpdateCaptainLocationBody } from "@/services/api/dto";
import { TRACKING_CONFIG } from "./config";

function nearlySame(a: UpdateCaptainLocationBody, b: UpdateCaptainLocationBody): boolean {
  return (
    Math.abs(a.latitude - b.latitude) < TRACKING_CONFIG.minCoordinateDelta &&
    Math.abs(a.longitude - b.longitude) < TRACKING_CONFIG.minCoordinateDelta
  );
}

/**
 * طابور نقاط عند انقطاع الشبكة — يُفرغ عند عودة الاتصال.
 */
export class LocationOutbox {
  private readonly items: UpdateCaptainLocationBody[] = [];

  enqueue(body: UpdateCaptainLocationBody): void {
    const last = this.items[this.items.length - 1];
    if (last && nearlySame(last, body)) return;
    this.items.push(body);
    while (this.items.length > TRACKING_CONFIG.outboxMax) {
      this.items.shift();
    }
  }

  size(): number {
    return this.items.length;
  }

  shift(): UpdateCaptainLocationBody | undefined {
    return this.items.shift();
  }

  peek(): UpdateCaptainLocationBody | undefined {
    return this.items[0];
  }
}
