# TO-GROW

기존 Google AI Studio 웹앱의 React 화면, Express 개발 서버와 Firebase 연결을 사용합니다.

- `npm ci`로 패키지를 설치한 뒤 `npm run dev`로 실행합니다.
- `npm run lint`에서 TypeScript를 확인합니다.
- `npm run build`와 `npm start`로 기존 환경의 웹앱을 빌드하고 실행합니다. 정적 결과를 제공할 때 `NODE_ENV=production`을 설정합니다.
- `npm run build:sites`는 동일한 서버 API를 Sites Worker용으로 패키징하고 웹 자산을 `dist/client`에 둡니다.

서버 비밀 환경 변수에는 `GEMINI_API_KEY`와 선택 사항인 `YOUTH_JOB_API_KEY`를 설정합니다. 기본 Gemini 모델은 `gemini-3.8-flash`이며, 필요한 경우 `GEMINI_MODEL`로 프로젝트가 접근할 수 있는 모델을 지정합니다. Gemini 응답이 없을 때 고민, 추천 질문과 로드맵에서는 기본 안내를 제공합니다. 체크인 기록은 Gemini 호출 전에 저장합니다. 공공기관 채용정보 API 키가 없거나 호출에 실패하면 기관 공식 공개정보를 안내합니다.

비회원 기록은 같은 사이트 주소의 브라우저 저장소에 남습니다. 기존 Firebase 프로젝트와 문서 경로는 그대로 사용합니다. 배포 주소가 바뀌면 해당 주소를 Firebase Authentication에서 허용해야 Google 로그인을 사용할 수 있습니다. 다른 주소에 저장된 브라우저 기록은 자동으로 이동하지 않습니다.
