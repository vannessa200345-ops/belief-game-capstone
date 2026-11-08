import { tx } from '../i18n/text.ts'

const copy: Record<string, [string, string]> = {
  pin_format: ['請輸入六位數字密碼。', 'Enter a six-digit password.'],
  pin_rejected: [
    '密碼不正確。個別場次請同時填寫房間碼。',
    'That password was not accepted. For a session password, include the room code.',
  ],
  pin_reserved: [
    '這個密碼已保留給平台營運，請另選六位數字。',
    'That password is reserved for the platform operator. Choose another six digits.',
  ],
  rate_limited: ['嘗試次數太多，請稍後再試。', 'Too many attempts. Please try again later.'],
  room_code: ['房間碼須為二至八位英文字母或數字。', 'Use a room code of 2 to 8 letters or digits.'],
  capacity: ['暫時未能開出這一場。', 'This session could not be opened.'],
  starts_at: ['請選擇未來兩年以內的日期與時間。', 'Choose a date and time within the next two years.'],
  host_label: ['主持名稱請保持在三十二個字以內。', 'Keep the host name within 32 characters.'],
  not_authenticated: ['未能建立身份，請再試一次。', 'Could not open a session. Try again.'],
  slot_not_found: ['找不到這個場次。', 'That session was not found.'],
  slot_closed: ['這個場次已不再接受登記。', 'This session is no longer open.'],
  slot_full: ['這一場已經額滿。', 'This session is already full.'],
  slot_taken: ['這位導師在該時間已有預約。', 'That teacher is already booked at that time.'],
  claim_invalid: ['領取碼不正確，或已經使用。', 'That claim code is not valid, or it has already been used.'],
  forbidden: ['你沒有權限處理這個場次。', 'You cannot manage this session.'],
  invalid_display_name: ['請留下名字，三十二個字以內。', 'Add a name, up to 32 characters.'],
  invalid_contact: ['聯絡方式請保持在八十個字以內。', 'Keep the contact within 80 characters.'],
  teacher_unavailable: ['這位導師暫未開放預約。', 'That teacher is not open for booking.'],
  migration_missing: [
    '資料庫尚未啟用主持密碼與預約。請先套用遷移。',
    'Host passwords and bookings are not enabled in the database yet. Apply the migration first.',
  ],
  network: ['連不上伺服器。請稍後再試。', 'Could not reach the server. Try again in a moment.'],
  conflict: ['這個場次剛剛已被更新，請再試一次。', 'That session was just updated. Try again.'],
  unknown: ['暫時未能完成。請再試一次。', 'That did not finish. Try again.'],
}

export function bookingMessage(code: string) {
  const pair = copy[code] ?? copy.unknown
  return tx(pair[0], pair[1])
}
