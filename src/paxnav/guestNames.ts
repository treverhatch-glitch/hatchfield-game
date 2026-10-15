/**
 * Passenger names for the guest card and the hover tooltip. Pure data plus one
 * stable pick: the same guest id always gets the same name, so a reload or a
 * different frame never renames anyone. Nothing here is saved.
 */
import { hashId } from './guests.ts'

export const GUEST_FIRST_NAMES = [
  'Amara', 'Ben', 'Chloe', 'Dmitri', 'Elena', 'Farid', 'Grace', 'Hiro', 'Imani', 'Jonas',
  'Kavya', 'Liam', 'Mei', 'Noah', 'Olivia', 'Priya', 'Quentin', 'Rosa', 'Sven', 'Tariq',
  'Uma', 'Victor', 'Wren', 'Xavier', 'Yuki', 'Zara', 'Aiden', 'Bianca', 'Carlos', 'Daria',
  'Emeka', 'Fiona', 'Gus', 'Hana', 'Ivan', 'Jada', 'Kofi', 'Lena', 'Mateo', 'Nadia',
  'Omar', 'Petra', 'Ravi', 'Sofia', 'Theo', 'Ulla', 'Vera', 'Will', 'Ximena', 'Yusuf',
  'Anan', 'Pim', 'Somchai', 'Mali', 'Niran', 'Ploy', 'Kritsada', 'Dao', 'Chai', 'Nok',
] as const

export const GUEST_LAST_NAMES = [
  'Adeyemi', 'Brooks', 'Chen', 'Dubois', 'Eriksen', 'Fischer', 'Garcia', 'Hassan', 'Ito', 'Jovanovic',
  'Khan', 'Lopez', 'Murphy', 'Novak', 'Okafor', 'Patel', 'Quinn', 'Rossi', 'Silva', 'Tanaka',
  'Ueda', 'Vargas', 'Walker', 'Xu', 'Yilmaz', 'Zhang', 'Andersen', 'Bianchi', 'Costa', 'Diaz',
  'Evans', 'Farouk', 'Grant', 'Haddad', 'Ivanov', 'Jensen', 'Kim', 'Larsen', 'Moreau', 'Nguyen',
  'Ortiz', 'Pereira', 'Reyes', 'Sato', 'Taylor', 'Usman', 'Volkov', 'Wright', 'Yamada', 'Zielinski',
  'Srisai', 'Chaiyo', 'Boonmee', 'Wong', 'Rahman', 'Singh', 'Cohen', 'Berg', 'Hughes', 'Lim',
] as const

/** A stable "First Last" for a guest id. */
export function guestName(id: string): string {
  const h = hashId(`name:${id}`)
  const first = GUEST_FIRST_NAMES[h % GUEST_FIRST_NAMES.length]
  const last = GUEST_LAST_NAMES[Math.floor(h / GUEST_FIRST_NAMES.length) % GUEST_LAST_NAMES.length]
  return `${first} ${last}`
}
