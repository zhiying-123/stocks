import "dotenv/config";
import prisma from "../lib/prisma";

async function main() {
  const email = "zy@zy";
  const password = "zy123";

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: "zy staff",
      password,
      role: "staff",
      status: "ACTIVE",
      access_time: 0,
    },
    create: {
      email,
      name: "zy staff",
      password,
      role: "staff",
      status: "ACTIVE",
      access_time: 0,
    },
  });

  console.log(
    JSON.stringify(
      {
        success: true,
        message: "Staff account ready",
        user: {
          u_id: user.u_id,
          email: user.email,
          role: user.role,
          status: user.status,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error("CREATE_STAFF_USER_FAILED", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
