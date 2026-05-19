import bcrypt from 'bcryptjs';

async function main() {
  const hash = await bcrypt.hash('student@kss', 10);
  console.log('Hash:', hash);
}

main();
