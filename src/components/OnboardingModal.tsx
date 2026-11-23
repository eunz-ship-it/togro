import React, { useState } from 'react';
import {
  FIELD_LIMITS,
  JOB_PREP_STATUS_OPTIONS,
  mapAgeToAgeGroup,
  type AgeGroup,
  type UserProfile,
} from '../types/domain';

interface OnboardingModalProps {
  defaultName: string;
  initialProfile?: UserProfile | null;
  onSave: (data: {
    nickname: string;
    age?: number;
    ageGroup: AgeGroup;
    jobPrepStatus?: string;
    region: string;
    interests: string[];
    currentGoalFocus: string;
    onboardingCompleted: boolean;
    onboardingSkipped: boolean;
  }) => Promise<void>;
  onCancel?: () => void;
}

const AGE_GROUPS: AgeGroup[] = ['19-24세', '25-29세', '30-34세', '미선택'];
const REGIONS = ['전체', '서울', '경기', '인천', '부산', '대구', '대전', '광주', '기타 지역'];
const INTEREST_OPTIONS = [
  '생활 리듬 회복',
  '진로 방향 탐색',
  '직무 역량 학습',
  '공공기관 채용',
  'IT·데이터',
  '디자인·콘텐츠',
  '행정·기획',
  '청년지원 정보',
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  defaultName,
  initialProfile,
  onSave,
  onCancel,
}) => {
  const [nickname, setNickname] = useState(
    (initialProfile?.nickname || defaultName).slice(0, FIELD_LIMITS.nicknameMax) || '청년'
  );
  const [age, setAge] = useState<string>(
    initialProfile?.age ? String(initialProfile.age) : '25'
  );
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(initialProfile?.ageGroup || '25-29세');
  const [jobPrepStatus, setJobPrepStatus] = useState<string>(
    initialProfile?.jobPrepStatus || JOB_PREP_STATUS_OPTIONS[0]
  );
  const [region, setRegion] = useState(initialProfile?.region || '서울');
  const [interests, setInterests] = useState<string[]>(
    initialProfile?.interests?.length
      ? initialProfile.interests
      : ['생활 리듬 회복', '진로 방향 탐색']
  );
  const [currentGoalFocus, setCurrentGoalFocus] = useState(initialProfile?.currentGoalFocus || '');
  const [saving, setSaving] = useState(false);

  const toggleInterest = (item: string) => {
    setInterests((prev) =>
      prev.includes(item)
        ? prev.filter((x) => x !== item)
        : prev.length < FIELD_LIMITS.interestsMaxCount
        ? [...prev, item]
        : prev
    );
  };

  const handleAgeChange = (val: string) => {
    setAge(val);
    const num = Number(val);
    if (Number.isInteger(num) && num >= 15 && num <= 99) {
      setAgeGroup(mapAgeToAgeGroup(num));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const parsedAge = Number(age);
    const validAge =
      Number.isInteger(parsedAge) && parsedAge >= 15 && parsedAge <= 99 ? parsedAge : undefined;
    try {
      await onSave({
        nickname: nickname.trim() || '청년',
        age: validAge,
        ageGroup: validAge ? mapAgeToAgeGroup(validAge) : ageGroup,
        jobPrepStatus,
        region: region === '전체' ? '' : region,
        interests,
        currentGoalFocus: currentGoalFocus.trim(),
        onboardingCompleted: true,
        onboardingSkipped: false,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    setSaving(true);
    try {
      await onSave({
        nickname: nickname.trim() || '청년',
        ageGroup: '미선택',
        jobPrepStatus: JOB_PREP_STATUS_OPTIONS[0],
        region: '',
        interests: [],
        currentGoalFocus: '',
        onboardingCompleted: true,
        onboardingSkipped: true,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto my-6 tg-card p-6 sm:p-8">
      <div className="flex items-start gap-3.5 mb-6">
        <img
          src="/assets/aistudio/to-grow___App_icon_f7f04fa0.png"
          alt="TOGRO 로고"
          className="w-10 h-10 rounded-xl object-cover shrink-0 mt-0.5"
        />
        <div>
          <p className="text-xs font-semibold text-[var(--tg-text-muted)] mb-1">TOGRO 맞춤 정보 설정</p>
          <h2 className="font-display text-2xl font-bold text-[var(--tg-text-strong)]">
            지금의 상태를 편한 만큼만 알려주세요
          </h2>
          <p className="text-sm text-[var(--tg-text-muted)] mt-1.5 leading-relaxed">
            입력하신 별명, 나이, 취업 준비 상황은 '나의 고민' 추천 질문과 지원 프로그램 안내를 맞추는 데에만 사용됩니다.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="onb-nick" className="block text-sm font-medium text-[var(--tg-text)] mb-1.5">
              별명
            </label>
            <input
              id="onb-nick"
              type="text"
              maxLength={FIELD_LIMITS.nicknameMax}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="예: 민수"
              className="tg-input w-full px-3.5 py-2.5 text-sm"
            />
          </div>

          <div>
            <label htmlFor="onb-age" className="block text-sm font-medium text-[var(--tg-text)] mb-1.5">
              나이
            </label>
            <input
              id="onb-age"
              type="number"
              min={15}
              max={99}
              value={age}
              onChange={(e) => handleAgeChange(e.target.value)}
              placeholder="예: 25"
              className="tg-input w-full px-3.5 py-2.5 text-sm font-mono tabular-nums"
            />
          </div>

          <div>
            <label htmlFor="onb-region" className="block text-sm font-medium text-[var(--tg-text)] mb-1.5">
              거주·활동 지역
            </label>
            <select
              id="onb-region"
              value={region || '전체'}
              onChange={(e) => setRegion(e.target.value)}
              className="tg-input w-full px-3.5 py-2.5 text-sm"
            >
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="onb-prep" className="block text-sm font-medium text-[var(--tg-text)] mb-1.5">
            현재 취업 준비 상황
          </label>
          <select
            id="onb-prep"
            value={jobPrepStatus}
            onChange={(e) => setJobPrepStatus(e.target.value)}
            className="tg-input w-full px-3.5 py-2.5 text-sm"
          >
            {JOB_PREP_STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className="block text-sm font-medium text-[var(--tg-text)] mb-2">연령대</span>
          <div className="flex flex-wrap gap-2">
            {AGE_GROUPS.map((ag) => (
              <button
                key={ag}
                type="button"
                onClick={() => setAgeGroup(ag)}
                className={`px-3.5 py-2 text-sm rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  ageGroup === ag
                    ? 'bg-[var(--tg-primary)] text-[var(--tg-text-strong)] border-[var(--tg-primary-border)] font-semibold'
                    : 'bg-[var(--tg-bg)] text-[var(--tg-text)] border-[var(--tg-border)] hover:bg-[var(--tg-primary-soft)]'
                }`}
              >
                {ag}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="block text-sm font-medium text-[var(--tg-text)] mb-2">
            요즘 관심이 가거나 필요한 영역 (복수 선택)
          </span>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((item) => {
              const selected = interests.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleInterest(item)}
                  className={`px-3.5 py-2 text-sm rounded-xl border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selected
                      ? 'bg-[var(--tg-secondary)] text-[var(--tg-text-strong)] border-[var(--tg-mint-border)] font-semibold'
                      : 'bg-[var(--tg-surface)] text-[var(--tg-text-muted)] border-[var(--tg-border)] hover:bg-[var(--tg-bg)] hover:text-[var(--tg-text)]'
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="onb-focus" className="block text-sm font-medium text-[var(--tg-text)] mb-1.5">
            지금 가장 먼저 해결하고 싶은 고민이나 바람 (선택)
          </label>
          <input
            id="onb-focus"
            type="text"
            maxLength={FIELD_LIMITS.goalFocusMax}
            value={currentGoalFocus}
            onChange={(e) => setCurrentGoalFocus(e.target.value)}
            placeholder="예: 생활 패턴을 정리하고 나에게 맞는 취업 지원 제도를 찾고 싶어요"
            className="tg-input w-full px-3.5 py-2.5 text-sm"
          />
        </div>

        <div className="pt-4 border-t border-[var(--tg-border)] flex flex-wrap items-center justify-between gap-3">
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="tg-btn-secondary px-4 py-2 text-sm whitespace-nowrap cursor-pointer"
            >
              돌아가기
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSkip}
              disabled={saving}
              className="tg-btn-secondary px-4 py-2 text-sm whitespace-nowrap cursor-pointer"
            >
              건너뛰고 먼저 둘러보기
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="tg-btn-primary px-5 py-2.5 text-sm whitespace-nowrap cursor-pointer"
          >
            {saving ? '저장 중...' : '이 설정으로 저장하기'}
          </button>
        </div>
      </form>
    </div>
  );
};
