// Small seeded PRNG so demo data looks the same on every reset.
export function createRandom(seed = 42) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
  };
}

export const FIRST_NAMES = ['Aarav', 'Vivaan', 'Aditya', 'Arjun', 'Sai', 'Reyansh', 'Krishna', 'Ishaan', 'Rohan', 'Kabir', 'Ananya', 'Diya', 'Priya', 'Saanvi', 'Aadhya', 'Kavya', 'Meera', 'Lakshmi', 'Pooja', 'Sneha', 'Rahul', 'Vikram', 'Karthik', 'Suresh', 'Ramesh', 'Deepa', 'Nandini', 'Harini', 'Fatima', 'Imran', 'Zoya', 'Gurpreet', 'Simran', 'Joseph', 'Mary', 'Divya', 'Manoj', 'Lavanya', 'Arun', 'Bhavna'];
export const LAST_NAMES = ['Sharma', 'Iyer', 'Reddy', 'Nair', 'Patel', 'Gupta', 'Kumar', 'Singh', 'Menon', 'Rao', 'Das', 'Mukherjee', 'Khan', 'Fernandes', 'Pillai', 'Joshi', 'Verma', 'Chatterjee', 'Shetty', 'Banerjee', 'Krishnan', 'Subramanian', 'Ahmed', 'Kaur', 'Desai'];

// Two draws per pick so names do not repeat in step with other random calls.
const mixedPick = (rnd, arr) => arr[Math.floor(((rnd.next() + rnd.next() * 7.31) % 1) * arr.length)];

export function indianName(rnd) {
  return `${mixedPick(rnd, FIRST_NAMES)} ${mixedPick(rnd, LAST_NAMES)}`;
}

export function indianPhone(rnd) {
  return `${rnd.pick(['9', '8', '7', '6'])}${String(rnd.int(0, 999999999)).padStart(9, '0')}`;
}
