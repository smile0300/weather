import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, SafeAreaView, Platform, StatusBar, TouchableOpacity, Text, View, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import * as ImageManipulator from 'expo-image-manipulator';
// [기본] 네트워크 에러 시 사용할 백업 HTML
const FALLBACK_HTML = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Loading...</title></head>
<body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#f0f2f5;font-family:sans-serif;flex-direction:column;">
    <div style="font-size:18px;font-weight:bold;color:#333;margin-bottom:10px;">날씨 정보를 불러오는 중입니다...</div>
    <div style="font-size:14px;color:#666;">(데이터를 가져오는 중이거나 오프라인 상태입니다)</div>
</body>
</html>
`;

export default function App() {
  const webviewRef = useRef(null);
  const viewShotRef = useRef(null);
  const [htmlContent, setHtmlContent] = useState(FALLBACK_HTML);
  const [status, requestPermission] = MediaLibrary.usePermissions();

  useEffect(() => {
    // 앱 시작 시 GitHub에서 최신 HTML을 가져옵니다.
    const fetchLatestHtml = async () => {
      try {
        const response = await fetch('https://raw.githubusercontent.com/k97460300-coder/weather/main/web_source/mobile_corrected.html');
        if (response.ok) {
          const html = await response.text();
          setHtmlContent(html);
        } else {
          console.warn('Failed to fetch from GitHub. Using fallback.');
        }
      } catch (error) {
        console.error('Fetch error:', error);
      }
    };

    fetchLatestHtml();
  }, []);

  const handleCapture = async () => {
    try {
      if (!status?.granted) {
        const permission = await requestPermission();
        if (!permission.granted) {
          Alert.alert('권한 필요', '갤러리 저장을 위해 미디어 라이브러리 접근을 허용해주세요.');
          return;
        }
      }

      const uri = await captureRef(viewShotRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });

      // 이미지 크기 확인
      const manipResult = await ImageManipulator.manipulateAsync(uri, []);
      const { width, height } = manipResult;
      const currentRatio = width / height;
      const targetRatio = 9 / 16;

      let actions = [];
      if (Math.abs(currentRatio - targetRatio) > 0.01) {
          let originX = 0;
          let originY = 0;
          let cropWidth = width;
          let cropHeight = height;

          if (currentRatio > targetRatio) {
              cropWidth = height * targetRatio;
              originX = (width - cropWidth) / 2;
          } else {
              cropHeight = width / targetRatio;
              originY = (height - cropHeight) / 2;
          }

          actions.push({
              crop: {
                  originX: Math.round(originX),
                  originY: Math.round(originY),
                  width: Math.round(cropWidth),
                  height: Math.round(cropHeight),
              }
          });
      }

      const finalResult = await ImageManipulator.manipulateAsync(
          uri,
          actions,
          { compress: 1, format: ImageManipulator.SaveFormat.PNG }
      );

      await MediaLibrary.saveToLibraryAsync(finalResult.uri);
      Alert.alert('저장 완료!', '갤러리에 9:16 비율로 저장되었습니다.');
    } catch (e) {
      console.error(e);
      Alert.alert('오류', '캡처에 실패했습니다: ' + e.message);
    }
  };

  const handleCaptureAll = async () => {
    try {
      if (!status?.granted) {
        const permission = await requestPermission();
        if (!permission.granted) {
          Alert.alert("Permission required", "Please allow access to media library to save screenshots.");
          return;
        }
      }

      const cardCount = 6;
      Alert.alert("Starting Capture", `Capturing all ${cardCount} cards, please wait...`);

      for (let i = 0; i < cardCount; i++) {
        const newScrollX = `window.innerWidth * ${i}`;
        webviewRef.current.injectJavaScript(
          `window.scrollTo({ left: ${newScrollX}, top: 0, behavior: 'instant' }); true;`
        );

        await new Promise(resolve => setTimeout(resolve, 1000));

        const uri = await captureRef(viewShotRef, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        });
        
        const manipResult = await ImageManipulator.manipulateAsync(uri, []);
        const { width, height } = manipResult;
        const targetRatio = 9 / 16;
        let actions = [];

        if (Math.abs((width / height) - targetRatio) > 0.01) {
            let cropWidth = Math.round(height * targetRatio);
            let originX = Math.round((width - cropWidth) / 2);
            actions.push({ crop: { originX, originY: 0, width: cropWidth, height: height } });
        }
        
        const finalResult = await ImageManipulator.manipulateAsync(
            uri,
            actions,
            { compress: 1, format: ImageManipulator.SaveFormat.PNG }
        );

        const asset = await MediaLibrary.createAssetAsync(finalResult.uri);
        const album = await MediaLibrary.getAlbumAsync('WeatherApp');
        if (album == null) {
          await MediaLibrary.createAlbumAsync('WeatherApp', asset, false);
        } else {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        }
      }

      Alert.alert("Capture Complete", `Saved ${cardCount} separate images to 'WeatherApp' album in your gallery.`);

    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to capture all cards.");
    } finally {
      webviewRef.current.injectJavaScript(
        `window.scrollTo({ left: 0, top: 0, behavior: 'instant' }); true;`
      );
    }
  };
  // [수정] 네이티브 브릿지: 프록시 제거 및 CCTV 허용 설정
  const INJECTED_CODE = `
    (function() {
      if (window.isNativeBridgeInjected) return;
      window.isNativeBridgeInjected = true;

      // CORS 경고창 숨기기
      try {
        const style = document.createElement('style');
        style.styleSheet ? (style.styleSheet.cssText = '.cors-alert { display: none !important; }') : style.appendChild(document.createTextNode('.cors-alert { display: none !important; }'));
        document.head.appendChild(style);
      } catch(e) {}

      const originalFetch = window.fetch;
      window.fetchCallbacks = {};

      window.fetch = async (input, init) => {
        let url = typeof input === 'string' ? input : input.url;

        // [중요] 모든 종류의 프록시 주소 제거
        const proxies = [
          'https://api.allorigins.win/raw?url=',
          'https://cors-anywhere.herokuapp.com/',
          'https://api.allorigins.win/get?url=',
          'https://api.allorigins.win/raw?url=' // 중복 제거 및 확실히 처리
        ];

        for (const proxy of proxies) {
          if (url.startsWith(proxy)) {
            url = decodeURIComponent(url.replace(proxy, ''));
          }
        }

        // 외부 API 호출 (apis.data.go.kr, jeju.go.kr, airport.co.kr 등)을 네이티브로 토스
        const isExternalApi = url.startsWith('http') && (
          url.includes('apis.data.go.kr') || 
          url.includes('jeju.go.kr') || 
          url.includes('airport.co.kr') ||
          url.includes('allorigins.win') // 혹시 안걸러진 경우 대비
        );

        if (isExternalApi && window.ReactNativeWebView) {
          return new Promise((resolve, reject) => {
            const reqId = Math.random().toString(36).substring(7);
            window.fetchCallbacks[reqId] = { resolve, reject };

            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'FETCH_REQUEST',
              reqId: reqId,
              url: url,
              options: init
            }));
          });
        }

        return originalFetch(input, init);
      };
    })();
    true;
  `;

  const onMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'FETCH_REQUEST') {
        try {
          // [수정] 네이티브에서 직접 fetch 수행 (CORS 영향 없음)
          // 일부 공공 API는 브라우저 User-Agent가 아니면 차단할 수 있으므로 헤더 추가
          const response = await fetch(data.url, {
            ...data.options,
            headers: {
              ...((data.options && data.options.headers) || {}),
              'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
            }
          });
          const responseText = await response.text();

          // 안전한 문자열 전달을 위해 JSON.stringify 사용
          const serializedText = JSON.stringify(responseText);

          // 응답 헤더 추출 (WebView의 Response 객체 생성을 위해)
          const respHeaders = {};
          response.headers.forEach((value, key) => {
            respHeaders[key] = value;
          });

          const jsCode = `
            if (window.fetchCallbacks['${data.reqId}']) {
              const res = new Response(${serializedText}, {
                status: ${response.status},
                headers: ${JSON.stringify(respHeaders)}
              });
              window.fetchCallbacks['${data.reqId}'].resolve(res);
              delete window.fetchCallbacks['${data.reqId}'];
            }
          `;
          webviewRef.current.injectJavaScript(jsCode);
        } catch (error) {
          console.error("Native Fetch Error:", error);
          const errorJs = `
            if (window.fetchCallbacks['${data.reqId}']) {
              window.fetchCallbacks['${data.reqId}'].reject(new Error("Native Fetch Failed"));
              delete window.fetchCallbacks['${data.reqId}'];
            }
          `;
          webviewRef.current.injectJavaScript(errorJs);
        }
      }
    } catch (e) {
      // 메시지 처리 에러 무시
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ViewShot ref={viewShotRef} style={{ flex: 1 }} collapsable={false}>
        <WebView
          ref={webviewRef}
          // [핵심] 다운로드 받은 HTML 문자열을 로컬 소스로 실행 -> Mixed Content 회피
          source={{ html: htmlContent, baseUrl: 'http://localhost/' }}
          style={styles.webview}
          mixedContentMode="always"
          javaScriptEnabled={true}
          domStorageEnabled={true}
          androidHardwareAccelerationDisabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo={true}
          originWhitelist={['*']}
          injectedJavaScriptBeforeContentLoaded={INJECTED_CODE}
          onMessage={onMessage}
        />
      </ViewShot>

      <TouchableOpacity 
        style={{
            position: 'absolute',
            bottom: 30,
            right: 170,
            backgroundColor: '#4a69bd',
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 25,
            elevation: 5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            zIndex: 100,
        }}
        onPress={handleCaptureAll}
      >
        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>📄 All Cards</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={{
            position: 'absolute',
            bottom: 30,
            right: 20,
            backgroundColor: '#ff5252',
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderRadius: 30,
            elevation: 5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            zIndex: 100,
        }}
        onPress={handleCapture}
      >
        <Text style={{ color: 'white', fontWeight: 'bold' }}>📸 9:16 Capture</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  webview: {
    flex: 1,
  },
});
