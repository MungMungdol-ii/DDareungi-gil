const https = require('https');

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function json(statusCode, body) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const KAKAO_REST_KEY = process.env.KAKAO_REST_KEY;
  const query = (event.queryStringParameters?.query || '').trim();

  if (!KAKAO_REST_KEY) {
    return json(500, { error: 'KAKAO_REST_KEY 환경변수가 설정되지 않았어요.' });
  }

  if (!query) {
    return json(200, []);
  }

  const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=7`;

  return new Promise((resolve) => {
    const req = https.get(url, { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode < 200 || res.statusCode >= 300 || parsed.errorType) {
            resolve(json(502, { error: '카카오 장소 검색에 실패했어요.' }));
            return;
          }
          resolve(json(200, parsed.documents || []));
        } catch (e) {
          resolve(json(500, { error: '카카오 응답을 해석하지 못했어요.' }));
        }
      });
    }).on('error', (e) => {
      resolve(json(502, { error: e.message }));
    });
    req.setTimeout(5000, () => req.destroy(new Error('카카오 요청 시간이 초과됐어요.')));
  });
};
