/**
 * roomId(예: "hall1-1") 또는 roomUuid → 한글 방 이름 매핑입니다.
 * 정답 CSV의 roomId 컬럼은 매핑된 방은 이름("hall1-1"), 미매핑 방은 UUID("e919462c-...")로 들어옵니다.
 * 두 형태 모두 처리합니다.
 */
export const ROOM_NAMES: Record<string, string> = {
  // roomId 이름 형태
  room1: "원우회실",
  room2: "스튜던트 라운지",
  room3: "419강의실",
  "hall1-1": "베란다 쪽 복도",
  "hall1-2": "라운지 앞 복도",
  "hall1-3": "정수기 근처 복도",
  "hall2-1": "화장실 앞",
  "hall2-2": "계단 쪽",
  // roomUuid 형태
  "cb3f5613-94eb-b618-8ba8-1bc3f24cbbc6": "원우회실",
  "316e933e-d06d-5af0-8919-10578ccd3900": "스튜던트 라운지",
  "5768d95b-6710-cc01-1e25-cd03767ab1dd": "419강의실",
  "6ac2d59f-e9a6-5fc7-ecf7-3617f7bf7133": "베란다 쪽 복도",
  "b887c5f7-5e25-95b0-b1d7-a2d13703e00a": "라운지 앞 복도",
  "3342022d-32d9-c32f-cc67-a6993db345ef": "정수기 근처 복도",
  "36f65d12-3dd9-957c-8535-9a774780e5f6": "화장실 앞",
  "93ad5dfc-c2c2-aab8-e032-758172c5a70d": "계단 쪽",
  // 미매핑 방
  "e919462c-b583-81fd-826a-a1dabc2022e4": "미매핑 (이름 미지정)",
};

/** roomId나 roomUuid를 한글 방 이름으로 바꿉니다. 모르는 값은 "미매핑"으로 표시합니다. */
export function roomName(roomId: string | null | undefined): string {
  if (!roomId) {
    return "-";
  }
  const trimmed = roomId.trim();
  return ROOM_NAMES[trimmed] ?? ROOM_NAMES[trimmed.toLowerCase()] ?? `미매핑 (${trimmed.slice(0, 8)})`;
}
