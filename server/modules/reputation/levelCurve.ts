import type { LevelThreshold } from "@shared/schema";

export const LEVEL_30_TARGET_SCORE = 7000;
export const LEVEL_50_TARGET_SCORE = 25000;

const LEVEL_NAMES = [
  "Newbie", "Newcomer", "Rookie", "Beginner", "Apprentice",
  "Learner", "Student", "Scholar", "Trainee", "Explorer",
  "Adventurer", "Wanderer", "Voyager", "Seeker", "Discoverer",
  "Initiate", "Participant", "Contributor", "Member", "Regular",
  "Active", "Enthusiast", "Veteran", "Devoted", "Dedicated",
  "Senior", "Experienced", "Skilled", "Proficient", "Advanced",
  "Expert", "Specialist", "Professional", "Authority", "Champion",
  "Master", "Virtuoso", "Elite", "Ace", "Prodigy",
  "Grandmaster", "Legend", "Icon", "Mythic", "Epic",
  "Legendary", "Immortal", "Titan", "Demigod", "God",
];

export function reputationLevelScore(level: number): number {
  if (level <= 1) return 0;
  if (level <= 30) {
    return Math.round(LEVEL_30_TARGET_SCORE * Math.pow((level - 1) / 29, 1.5));
  }
  if (level <= 50) {
    return Math.round(LEVEL_30_TARGET_SCORE + (LEVEL_50_TARGET_SCORE - LEVEL_30_TARGET_SCORE) * Math.pow((level - 30) / 20, 1.25));
  }
  const extraLevel = level - 50;
  return Math.round(LEVEL_50_TARGET_SCORE + 1250 * extraLevel + 20 * Math.pow(extraLevel, 1.35));
}

export function reputationFormulaLevelFromScore(score: number): number {
  if (score <= 0) return 1;
  let low = 1;
  let high = 50;
  while (reputationLevelScore(high) <= score) high *= 2;
  while (low < high) {
    const mid = Math.floor((low + high + 1) / 2);
    if (reputationLevelScore(mid) <= score) low = mid;
    else high = mid - 1;
  }
  return low;
}

export function buildDefaultReputationLevels(): LevelThreshold[] {
  return Array.from({ length: 50 }, (_, index) => {
    const level = index + 1;
    return {
      level,
      score: reputationLevelScore(level),
      name: LEVEL_NAMES[index] ?? `Level ${level}`,
      image: null,
      chatRoomSize: level === 1 ? null : Math.min(100, 3 + level * 2),
      groupSize: level < 5 ? null : level <= 30 ? 5 + (level - 5) * 4 : 90 + (level - 30) * 6,
      numGroupChatRooms: level < 5 ? null : Math.min(10, Math.max(1, Math.floor(level / 4))),
      createChatRoom: level >= 3,
      createGroup: level >= 5,
      publishPhoto: level >= 2,
      postCommentLikeUserWall: level >= 2,
      addToPhotoWall: level >= 4,
      enterPot: level >= 10,
      numGroupModerators: level < 5 ? 0 : Math.min(10, Math.floor(level / 5)),
    };
  }).sort((a, b) => b.score - a.score);
}