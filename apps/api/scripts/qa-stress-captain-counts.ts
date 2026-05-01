import "dotenv/config";
import { CaptainAvailabilityStatus, UserRole } from "@prisma/client";
import { prisma } from "../src/lib/prisma.js";
import { QA_STRESS_CAPTAIN_NAME_RE, QA_STRESS_COMPANY_NAME_RE } from "./qa-stress-constants.js";

async function main() {
  const companies = await prisma.company.findMany({
    where: { name: { startsWith: "QA-STRESS-Company-" } },
    select: { id: true, name: true },
  });
  const companyIds = companies.filter((c) => QA_STRESS_COMPANY_NAME_RE.test(c.name)).map((c) => c.id);
  const captains = await prisma.captain.findMany({
    where: { companyId: { in: companyIds }, user: { role: UserRole.CAPTAIN } },
    select: {
      id: true,
      isActive: true,
      availabilityStatus: true,
      user: { select: { fullName: true } },
    },
  });
  const qa = captains.filter((c) => QA_STRESS_CAPTAIN_NAME_RE.test(c.user.fullName));
  const active = qa.filter((c) => c.isActive).length;
  const available = qa.filter((c) => c.availabilityStatus === CaptainAvailabilityStatus.AVAILABLE).length;
  const withLocation = await prisma.captainLocation
    .groupBy({
      by: ["captainId"],
      where: { captainId: { in: qa.map((c) => c.id) } },
      _count: { captainId: true },
    })
    .then((rows) => rows.length);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ qaCaptains: qa.length, active, available, withLocation }, null, 2));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

