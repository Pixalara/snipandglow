function getIstDayBounds(offsetDays) {
  // Using a fixed date for simulation: April 9, 2026, 11:30 AM IST
  const now = new Date("2026-04-09T11:30:00+05:30");
  
  // Method 1: The model's current code
  const todayIstStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const todayIst = new Date(todayIstStr);
  const targetDate = new Date(todayIst);
  targetDate.setDate(targetDate.getDate() + offsetDays);
  
  const y = targetDate.getFullYear();
  const m = targetDate.getMonth() + 1;
  const d = targetDate.getDate();
  
  const pad = (n) => n.toString().padStart(2, '0');
  const startIso = `${y}-${pad(m)}-${pad(d)}T00:00:00.000+05:30`;
  const startUnix = new Date(startIso).getTime();
  
  const endIso = `${y}-${pad(m)}-${pad(d)}T23:59:59.999+05:30`;
  const endUnix = new Date(endIso).getTime();

  console.log(`Input 'Now': ${now.toISOString()}`);
  console.log(`todayIstStr: ${todayIstStr}`);
  console.log(`todayIst interpreted as: ${todayIst.toISOString()}`);
  console.log(`Target Date (${offsetDays} days): ${targetDate.toDateString()}`);
  console.log(`Start IST: ${startIso} -> ${startUnix}`);
  console.log(`End IST: ${endIso} -> ${endUnix}`);
  
  // Check if "12 April 2026" (e.g. at 10 AM) fits
  const dhatraExpiry = new Date("2026-04-12T10:00:00+05:30").getTime();
  console.log(`Dhatra (April 12 10AM): ${dhatraExpiry}`);
  console.log(`Matches? ${dhatraExpiry >= startUnix && dhatraExpiry <= endUnix}`);
}

console.log("--- Testing Offset 3 ---");
getIstDayBounds(3);
