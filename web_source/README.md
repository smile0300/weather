# 제주 날씨 정보 웹앱 (Jeju Weather Info Web App)

이 문서는 `mobile.html` 파일의 구조와 작동 방식에 대해 설명합니다. 이 파일은 중국 관광객을 대상으로 제주의 실시간 날씨 정보, CCTV, 한라산 통제 정보 등을 제공하는 단일 페이지 웹 애플리케이션입니다.

## 1. UI 구조 (UI Structure)

이 앱은 순수 HTML, CSS, JavaScript로만 구성되어 있으며, 다음과 같은 특징을 가집니다.

- **카드 기반 레이아웃 (Card-based Layout)**:
  - 전체 화면을 차지하는 6개의 카드가 가로로 배열되어 있습니다.
  - 사용자는 좌우로 스와이프하여 카드 간에 이동할 수 있습니다. (`scroll-snap-type: x mandatory` CSS 속성 사용)
  - 각 카드는 CCTV, 시간대별 예보(2개), 주간 예보(2개), 한라산 상태 정보를 담고 있습니다.

- **동적 콘텐츠 로딩 (Dynamic Content Loading)**:
  - 페이지가 로드되면, 각 카드의 내용은 비어있거나 "로딩 중..." 메시지를 표시합니다.
  - JavaScript 함수(`initDaily`, `initWeekly` 등)가 실행되어 각 API에서 데이터를 가져온 후, 해당 카드에 동적으로 HTML 콘텐츠를 생성하여 채워 넣습니다.

- **스타일링 (Styling)**:
  - 모든 스타일은 `<style>` 태그 안에 순수 CSS로 작성되었습니다.
  - Flexbox를 사용하여 반응형 및 정렬된 레이아웃을 구현합니다.

## 2. 데이터 소스 및 API (Data Sources & APIs)

모든 데이터는 페이지 로드 시 클라이언트 측 JavaScript의 `fetch` API를 통해 가져옵니다.

### 가. CCTV (`initCCTV` 함수)

- **데이터**: 제주시에서 제공하는 실시간 HLS (.m3u8) 스트리밍 URL을 사용합니다.
- **기능**: `hls.js` 라이브러리를 사용하여 `<video>` 태그에서 스트리밍을 재생합니다.
- **URL 예시**:
  - 우도: `http://211.114.96.121:1935/jejusi7/11-24.stream/playlist.m3u8`
  - 윗세오름: `http://119.65.216.155:1935/live/cctv03.stream_360p/playlist.m3u8`

### 나. 시간대별 예보 (`initDaily` 함수)

- **API**: 기상청 **단기예보** 조회서비스 (`VilageFcstInfoService_2.0/getVilageFcst`)
- **주요 파라미터**:
  - `base_date`: 발표일자
  - `base_time`: 발표시각 (코드에서는 `0200`을 기본으로 사용)
  - `nx`, `ny`: 날씨 정보를 조회할 지역의 격자 X, Y 좌표
- **조회 지역**: 총 4곳의 좌표를 하드코딩하여 순차적으로 조회합니다.
  - 제주시 (연동), 서귀포 (중문), 한라산, 우도

### 다. 주간 예보 (`initWeekly` 함수)

- **특징**: **단기예보**와 **중기예보** API를 조합하여 +10일간의 날씨를 제공합니다.
- **+0~+3일 예보**: 단기예보(`getVilageFcst`)를 사용하여 최저/최고 기온과 날씨 아이콘을 결정합니다.
- **+4~+10일 예보**: 기상청 **중기예보**를 사용합니다.
  - **API 1**: `MidFcstInfoService/getMidTa` (중기기온예보)
    - 최저/최고 기온 정보를 가져옵니다.
  - **API 2**: `MidFcstInfoService/getMidLandFcst` (중기육상예보)
    - 날씨 상태(예: 맑음, 흐림) 및 강수확률 정보를 가져옵니다.
  - **`tmFc` (발표시각) 로직**: 중기예보는 하루 2번(06:00, 18:00) 발표됩니다. 앱을 여는 시간에 맞춰 가장 최신 데이터를 요청하도록 아래와 같이 `tmFc` 값을 계산합니다.
    - **06:15 이전**: 전날 18:00 발표 데이터
    - **06:15 ~ 18:15**: 당일 06:00 발표 데이터
    - **18:15 이후**: 당일 18:00 발표 데이터

### 라. 한라산 통제 정보 (`initHallasan` 함수)

- **방식**: 웹 스크레이핑(크롤링)
- **대상 URL**: `https://jeju.go.kr/tool/hallasan/road-body.jsp`
- **CORS 처리**: 브라우저에서 직접 실행 시 발생하는 CORS(Cross-Origin Resource Sharing) 문제를 피하기 위해 `api.allorigins.win`과 같은 프록시 서버를 경유하는 로직이 포함되어 있습니다. (네이티브 앱에서는 이 프록시가 필요 없습니다.)
- **파싱**: `fetch`로 가져온 HTML 텍스트를 `DOMParser`로 파싱한 후, CSS 선택자를 이용해 각 탐방로의 통제 상태(`정상`, `부분`, `통제`)를 추출합니다.

## 3. 네이티브 앱 연동 (`weather-app` 프로젝트)

- 이 `mobile.html` 파일은 `weather-app` React Native 프로젝트의 WebView 내에서 실행되도록 설계되었습니다.
- **`App.js`** 파일은 시작 시 GitHub Pages에 배포된 최신 `mobile.html`을 다운로드하여 WebView에 띄웁니다.
- **네이티브 브릿지**: `App.js`는 WebView에 JavaScript 코드를 주입하여 `mobile.html`의 모든 `fetch` 요청을 가로챕니다.
- 가로챈 요청이 기상청(`apis.data.go.kr`) 또는 한라산(`jeju.go.kr`) URL일 경우, 요청을 React Native의 네이티브 환경으로 전달하여 직접 API를 호출합니다.
- 이 방식을 통해, 웹페이지 자체의 한계인 CORS 문제 없이 네이티브 앱이 직접 데이터를 가져와 WebView에 결과를 반환해줍니다.