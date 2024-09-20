let landMoney, siksang, polygonsFromLandMoney = [], polygonsFromsiksang = [];
let polygonsVisible = false, birdZone = [], breathHole = [], breathHoleMarkers = [];
let positions = [], polygon = null, isDrawing = false, clickCount = 0;
let allBreathHoleMarkers = [];
let markersVisible = false;

fetch('sq_pt3.geojson')
    .then(response => response.json())
    .then(data => displayGeoJsonOnMap(data))
    .catch(error => console.error('공시지가 불러오기 오류:', error));

fetch('sungsan_ndvi.geojson')
    .then(response => response.json())
    .then(data => displaySiksangOnMap(data))
    .catch(error => console.error('식생지수 불러오기 오류:', error));

fetch('BirdZone.json')
    .then(response => response.json())
    .then(data => {
        birdZone = data;
    })
    .catch(error => console.error('Target points 불러오기 오류:', error));

fetch('breathHole.json')
    .then(response => response.json())
    .then(data => {
        initializeBreathHoleData(data);
    })
    .catch(error => console.error('breathHole 불러오기 오류:', error));

var map = new kakao.maps.Map(document.getElementById('map'), {
    center: new kakao.maps.LatLng(33.40167, 126.62917),
    level: 9
});
document.getElementById('closeInfo').addEventListener('click', function () {
    document.getElementById('info').style.display = 'none';
    isInfoVisible = false;
    if (polygon) {
        polygon.setMap(null);
    }
});

let circles = []; // 원을 저장할 배열
let circlesVisible = false;
const infoArea = document.getElementById('info');
let isInfoVisible = false;
document.getElementById('birdzone-button').addEventListener('click', function () {
    polygonsVisible = !polygonsVisible;
    if (polygonsVisible) {
        drawallbirdzone(birdZone);
        this.style.filter = 'invert(20%) sepia(39%) saturate(4000%) hue-rotate(100deg) brightness(300%) contrast(100%)'; // 밝은 초록색 (on 상태)
    } else {
        circles.forEach(circle => circle.setMap(null)); 
        circles = []; 
        this.style.filter = 'invert(20%) sepia(39%) saturate(4404%) hue-rotate(100deg) brightness(70%) contrast(100%)'; // 밝은 초록색 (on 상태)
    }
});
function drawallbirdzone(points) {
    circles.forEach(circle => circle.setMap(null));
    circles = [];
    points.forEach(point => {
        var circleCenter = new kakao.maps.LatLng(point.lat, point.lng);
        var circle = new kakao.maps.Circle({
            center: circleCenter,  // 원의 중심 좌표
            radius: 500,           // 원의 반지름 (500미터)
            strokeWeight: 3,       // 선의 두께
            strokeColor: '#00A0FF', // 선의 색깔
            strokeOpacity: 0.8,    // 선의 투명도
            strokeStyle: 'dash',  // 선의 스타일
            fillColor: '#CFE7FF',  // 채우기 색깔
            fillOpacity: 0.6       // 채우기 투명도
        });
        circle.setMap(map); // 원을 지도에 표시
        circles.push(circle); // circles 배열에 저장
    });
}

function moveInfoArea(x, y, animate = false) {
    infoArea.style.left = `${x + 10}px`;
    infoArea.style.top = `${y - 30}px`;
    infoArea.style.display = 'block';
    isInfoVisible = true;

    // 애니메이션이 필요할 때만 클래스 추가
    if (animate) {
        infoArea.classList.add('animated');
        infoArea.addEventListener('animationend', function handleAnimationEnd() {
            // 애니메이션이 끝난 후에만 클래스를 제거
            infoArea.classList.remove('animated');
            // 이벤트 리스너를 제거하여 중복 호출 방지
            infoArea.removeEventListener('animationend', handleAnimationEnd);
        });
    } else {
        // 애니메이션이 필요 없을 때는 클래스를 추가하지 않음
        infoArea.classList.remove('animated');
    }
}
kakao.maps.event.addListener(map, 'rightclick', function (mouseEvent) {
    var mapProjection = map.getProjection();
    var latLng = mouseEvent.latLng;
    
    if (clickCount === 0) {
        positions = [latLng];
        isDrawing = true;
        infoArea.style.display = 'none';
        isInfoVisible = false;
        if (polygon) {
            polygon.setMap(null);
        }
        clickCount = 1;
        kakao.maps.event.addListener(map, 'mousemove', onMouseMove);
    } else {
        positions.push(latLng);
        isDrawing = false;
        clickCount = 0;
        kakao.maps.event.removeListener(map, 'mousemove', onMouseMove);
        let firstPoint = mapProjection.containerPointFromCoords(positions[0]);
        let lastPoint = mapProjection.containerPointFromCoords(positions[1]);
        moveInfoArea(Math.max(firstPoint.x, lastPoint.x), Math.min(firstPoint.y, lastPoint.y),true);
        checkOverlap();
        checkBreathHoleContainment();
        addMarkersForBreathHole();
        calculateMinDifferences();
    }
});
function updateInfoAreaPosition() {
    if (positions.length === 2) { // 좌표가 저장되어 있는 경우에만 실행
        const mapProjection = map.getProjection();
        let firstPoint = mapProjection.containerPointFromCoords(positions[0]);
        let lastPoint = mapProjection.containerPointFromCoords(positions[1]);
        moveInfoArea(Math.max(firstPoint.x, lastPoint.x), Math.min(firstPoint.y, lastPoint.y),false);
    }
}

kakao.maps.event.addListener(map, 'bounds_changed', function () {
    if (isInfoVisible) { // info가 현재 표시되고 있을 때만 위치 업데이트
        updateInfoAreaPosition();
    }
});

function onMouseMove(mouseEvent) {
    if (isDrawing && positions.length === 1) {
        var latLng = mouseEvent.latLng;
        var bounds = new kakao.maps.LatLngBounds();
        bounds.extend(positions[0]);
        bounds.extend(latLng);

        var sw = bounds.getSouthWest();
        var ne = bounds.getNorthEast();

        var polygonPath = [
            new kakao.maps.LatLng(sw.getLat(), sw.getLng()),
            new kakao.maps.LatLng(sw.getLat(), ne.getLng()),
            new kakao.maps.LatLng(ne.getLat(), ne.getLng()),
            new kakao.maps.LatLng(ne.getLat(), sw.getLng())
        ];

        if (polygon) {
            polygon.setMap(null);
        }

        polygon = new kakao.maps.Polygon({
            map: map,
            path: polygonPath,
            strokeWeight: 2,
            strokeColor: '#FF0000',
            strokeOpacity: 0.8,
            fillColor: '#FF0000',
            fillOpacity: 0.4
        });
    }
}

function displayGeoJsonOnMap(geojson) {
    geojson.features.forEach(feature => {
        if (feature.geometry.type === "MultiPolygon") {
            feature.geometry.coordinates.forEach(polygonCoordinates => {
                polygonCoordinates.forEach(coordinateSet => {
                    var path = coordinateSet.map(coord => new kakao.maps.LatLng(coord[1], coord[0]));
                    polygonsFromLandMoney.push(createPolygon(path, feature.properties.val || 0));
                });
            });
        }
    });
}

function displaySiksangOnMap(geojson) {
    geojson.features.forEach(feature => {
        let coordinates = feature.geometry.type === "MultiPolygon" ? feature.geometry.coordinates[0] : feature.geometry.coordinates;
        coordinates.forEach(coordinateSet => {
            var path = coordinateSet.map(coord => new kakao.maps.LatLng(coord[1], coord[0]));
            polygonsFromsiksang.push(createPolygon(path, feature.properties.VALUE || 0));
        });
    });
}

function createPolygon(path, value) {
    return {
        polygon: new kakao.maps.Polygon({
            map: null,
            path: path,
            strokeWeight: 2,
            strokeColor: '#004c80',
            strokeOpacity: 0.8,
            fillColor: '#A3A3FF',
            fillOpacity: 0
        }),
        val: value
    };
}

function checkOverlap() {
    let userPolygonCoords = polygon.getPath().map(latLng => [latLng.getLng(), latLng.getLat()]);
    userPolygonCoords.push(userPolygonCoords[0]);
    let userPolygon = turf.polygon([userPolygonCoords]);

    let totalCost = polygonsFromLandMoney.reduce((total, geoPolygonObj) => {
        let geoCoords = geoPolygonObj.polygon.getPath().map(latLng => [latLng.getLng(), latLng.getLat()]);
        geoCoords.push(geoCoords[0]);
        let turfGeoPolygon = turf.polygon([geoCoords]);
        let intersection = turf.intersect(userPolygon, turfGeoPolygon);
        return total + (intersection ? turf.area(intersection) * geoPolygonObj.val : 0);
    }, 0);

    let formattedCost = Math.round(totalCost).toLocaleString() + ' 원';
    let additionalInfo = totalCost < 100000000 ? ` (${(totalCost / 10000).toFixed(2)} 만원)` : ` (${(totalCost / 100000000).toFixed(2)} 억원)`;
    document.getElementById('total-cost').innerText = formattedCost + additionalInfo;

    checkOverlapAndCalculateAverage();
}

function checkOverlapAndCalculateAverage() {
    let userPolygonCoords = polygon.getPath().map(latLng => [latLng.getLng(), latLng.getLat()]);
    userPolygonCoords.push(userPolygonCoords[0]);
    let userPolygon = turf.polygon([userPolygonCoords]);

    let { totalValue, count } = polygonsFromsiksang.reduce((acc, geoPolygonObj) => {
        let geoCoords = geoPolygonObj.polygon.getPath().map(latLng => [latLng.getLng(), latLng.getLat()]);
        geoCoords.push(geoCoords[0]);
        let turfGeoPolygon = turf.polygon([geoCoords]);
        let intersection = turf.intersect(userPolygon, turfGeoPolygon);
        if (intersection) {
            acc.totalValue += geoPolygonObj.val;
            acc.count++;
        }
        return acc;
    }, { totalValue: 0, count: 0 });

    let averageValue = count > 0 ? totalValue / count : null;
    updateVegetationLevel(averageValue);
}

function updateVegetationLevel(averageValue) {
    let level, message, barsCount;
    let barImages = [
        'img/ndvi_1.png',
        'img/ndvi_2.png',
        'img/ndvi_3.png',
        'img/ndvi_4.png',
        'img/ndvi_5.png'
    ];

    if (averageValue === null) {
        level = 'N/A'; message = '식생 정보 없음'; barsCount = 1;
    } else if (averageValue <= 0.2) {
        level = '1단계'; message = '매우 안전'; barsCount = 1;
    } else if (averageValue <= 0.33) {
        level = '2단계'; message = '안전'; barsCount = 2;
    } else if (averageValue <= 0.47) {
        level = '3단계'; message = '보통'; barsCount = 3;
    } else if (averageValue < 0.6) {
        level = '4단계'; message = '경고'; barsCount = 4;
    } else {
        level = '5단계'; message = '위험'; barsCount = 5;
    }

    // 텍스트 업데이트
    document.getElementById('vegetation-level').textContent = `${message} (${level})`;
    // 이미지 업데이트
    const vegetationImage = document.getElementById('vegetation-image');
    vegetationImage.src = barImages[barsCount - 1];  // 배열 인덱스는 0부터 시작하므로 -1 필요
    vegetationImage.style.display = 'block';  // 이미지를 보이게 설정

}

const initialFilter = 'invert(20%) sepia(39%) saturate(3000%) hue-rotate(100deg) brightness(90%) contrast(107%)';
const toggleFilter = 'invert(20%) sepia(39%) saturate(3000%) hue-rotate(100deg) brightness(300%) contrast(107%)'; // 클릭 후 필터

document.getElementById('lineButton').addEventListener('click', function () {
    polygonsVisible = !polygonsVisible;
    polygonsFromLandMoney.forEach(geoPolygonObj => geoPolygonObj.polygon.setMap(polygonsVisible ? map : null));
    this.style.filter = polygonsVisible ? toggleFilter : initialFilter;
});


function calculateMinDifferences() {
    const [firstLat, firstLng] = [positions[0].getLat(), positions[0].getLng()];
    const [lastLat, lastLng] = [positions[1].getLat(), positions[1].getLng()];

    // 좌표를 저장할 배열
    let nearPoints = [];

    birdZone.forEach(targetPoint => {
        let MinDiff;
        const isLatInRange = (firstLat <= targetPoint.lat && targetPoint.lat <= lastLat) || (lastLat <= targetPoint.lat && targetPoint.lat <= firstLat);
        const isLngInRange = (firstLng <= targetPoint.lng && targetPoint.lng <= lastLng) || (lastLng <= targetPoint.lng && targetPoint.lng <= firstLng);

        if (isLatInRange && isLngInRange) {
            nearPoints.push(targetPoint);
        } else {
            if (isLatInRange) {
                const closestLng = Math.abs(firstLng - targetPoint.lng) < Math.abs(lastLng - targetPoint.lng) ? firstLng : lastLng;
                MinDiff = convertToDistance(0, targetPoint.lng, 0, closestLng);
            } else if (isLngInRange) {
                const closestLat = Math.abs(firstLat - targetPoint.lat) < Math.abs(lastLat - targetPoint.lat) ? firstLat : lastLat;
                MinDiff = convertToDistance(targetPoint.lat, 0, closestLat, 0);
            } else {
                const closestLat = Math.abs(firstLat - targetPoint.lat) < Math.abs(lastLat - targetPoint.lat) ? firstLat : lastLat;
                const closestLng = Math.abs(firstLng - targetPoint.lng) < Math.abs(lastLng - targetPoint.lng) ? firstLng : lastLng;
                MinDiff = convertToDistance(targetPoint.lat, targetPoint.lng, closestLat, closestLng);
            }

            if (MinDiff < 800) {
                nearPoints.push(targetPoint);
            }
        }
    });
    drawallbirdzone(nearPoints);
    updateBirdZoneWarning(nearPoints.length > 0);
}

function updateBirdZoneWarning(isNear) {
    const warningElement = document.getElementById('birdzone-warning');

    if (isNear) {
        warningElement.textContent = '경고. 철새도래지 근처입니다';
    } else {
        warningElement.textContent = '';
    }
}

function checkBreathHoleContainment() {
    let userPolygonCoords = polygon.getPath().map(latLng => [latLng.getLng(), latLng.getLat()]);
    userPolygonCoords.push(userPolygonCoords[0]);
    let userPolygon = turf.polygon([userPolygonCoords]);

    let isBreathHoleIncluded = breathHole.some(point => {
        let targetPoint = turf.point([point.lng, point.lat]);
        return turf.booleanPointInPolygon(targetPoint, userPolygon);
    });

    updateBreathHoleWarning(isBreathHoleIncluded);
}

function updateBreathHoleWarning(isBreathHoleIncluded) {
    document.getElementById('breathHole-warning').textContent = isBreathHoleIncluded ? '경고. 해당 영역 내에 숨골이 위치합니다' : '';
}

const markerImageSrc = 'breathhole.png';
const markerImageSize = new kakao.maps.Size(20, 20);
const markerImage = new kakao.maps.MarkerImage(markerImageSrc, markerImageSize);

function animateSize(marker, duration) {
    const initialSize = markerImageSize;
    const maxSize = new kakao.maps.Size(30, 30);

    let startTime = null;

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const progress = (timestamp - startTime) / (duration / 2);

        const easedProgress = progress < 0.5
            ? 2 * progress * progress
            : -1 + (4 - 2 * progress) * progress;

        const size = progress < 0.5
            ? new kakao.maps.Size(
                initialSize.width + (maxSize.width - initialSize.width) * easedProgress,
                initialSize.height + (maxSize.height - initialSize.height) * easedProgress
            )
            : new kakao.maps.Size(
                maxSize.width - (maxSize.width - initialSize.width) * easedProgress,
                maxSize.height - (maxSize.height - initialSize.height) * easedProgress
            );

        marker.setImage(new kakao.maps.MarkerImage(markerImageSrc, size));

        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }

    requestAnimationFrame(step);
}

function addMarkersForBreathHole() {
    // 기존 마커를 제거
    breathHoleMarkers.forEach(marker => marker.setMap(null));
    breathHoleMarkers = [];

    let userPolygonCoords = polygon.getPath().map(latLng => [latLng.getLng(), latLng.getLat()]);
    userPolygonCoords.push(userPolygonCoords[0]);
    let userPolygon = turf.polygon([userPolygonCoords]);

    breathHole.forEach(point => {
        let targetPoint = turf.point([point.lng, point.lat]);
        if (turf.booleanPointInPolygon(targetPoint, userPolygon)) {
            let marker = new kakao.maps.Marker({
                position: new kakao.maps.LatLng(point.lat, point.lng),
                map: map,
            });

            // 애니메이션 실행
            animateSize(marker, 600);

            breathHoleMarkers.push(marker);
        }
    });
}

function toggleBreathHoleMarkers() {
    if (markersVisible) {
        // 마커가 보이는 상태라면 모든 마커를 삭제합니다.
        allBreathHoleMarkers.forEach(marker => marker.setMap(null));
        allBreathHoleMarkers = [];
    } else {
        // 마커가 보이지 않는 상태라면 모든 마커를 생성합니다.
        breathHole.forEach(point => {
            let markerPosition = new kakao.maps.LatLng(point.lat, point.lng);

            let marker = new kakao.maps.Marker({
                position: markerPosition,
                map: map,
                image: markerImage
            });

            animateSize(marker, 600);
            allBreathHoleMarkers.push(marker);
        });
    }
    // 상태를 토글합니다.
    markersVisible = !markersVisible;

    // 버튼 텍스트를 업데이트합니다.
    document.getElementById('breathholeButton').style.filter = markersVisible ? toggleFilter : initialFilter;
}
// 이벤트 리스너를 설정합니다.
document.getElementById('breathholeButton').addEventListener('click', toggleBreathHoleMarkers);

// breathHole 데이터를 불러온 후 실행할 함수
function initializeBreathHoleData(data) {
    breathHole = data;
    // 추가적인 초기화 작업이 필요하다면 여기에 작성
}
function convertToDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // 지구 반지름 (미터)
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLng = (lng2 - lng1) * rad;

    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // 미터 단위 거리
}
var airposition = new kakao.maps.LatLng(33.4179866, 126.8870703);
var proj = map.getProjection();
var currentOverlay = null;
function adjustImageSize() {
    var center = map.getCenter();
    var level = map.getLevel();
    if (currentOverlay) {
        currentOverlay.setMap(null);
    }
    // 지도 레벨마다 m값에 해당하는 화면좌표 수치(px)를 구할 수 있으므로
    // 지도 중심의 좌표를 화면좌표로 투영시켜
    // 화면좌표 기준으로 계산할 예정
    var centerPoint = proj.pointFromCoords(airposition);

    // 3레벨에서 1px이 1m
    // 현재 지도 레벨을 기준으로 m당 px값 스케일(px/m)을 구한다.
    var scale = 1 / Math.pow(2, level - 3);

    // 구하고자 하는 사각형 한 변의 길이
    var len = 100;

    // 1/2m에 해당하는 화면좌표(px) 값
    var pixelForHalfLen = len / 2 * scale;

    var airwidth = 800 * scale;
    var airheight = 3900 * scale;

    var content = document.createElement('div');
    content.style.width = airwidth + 'px';
    content.style.height = airheight + 'px';
    content.style.overflow = 'hidden';
    content.innerHTML = '<img src="img/airport.png" style="width: 100%; height: 100%;">';

    var customOverlay = new kakao.maps.CustomOverlay({
        position: airposition,  // 오버레이가 표시될 위치
        content: content,    // 오버레이의 내용
        map: map,            // 오버레이를 표시할 지도
        yAnchor: 0.5         // 오버레이의 y축 기준점 (0 ~ 1 사이 값으로 설정)
    });
    currentOverlay = customOverlay;
    customOverlay.setMap(map);
}
kakao.maps.event.addListener(map, 'zoom_changed', adjustImageSize);
adjustImageSize();

