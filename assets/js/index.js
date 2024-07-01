var DATA;
var map;
var mapContainer = document.getElementById('map'), // 지도를 표시할 div 
	mapOption = {
		center: new kakao.maps.LatLng(37.5665, 126.9780), // 서울의 중심 좌표
		level: 5 // 지도의 확대 레벨
	};

map = new kakao.maps.Map(mapContainer, mapOption); // 지도를 생성합니다

var clusterer = new kakao.maps.MarkerClusterer({
	map: map, // 마커들을 클러스터로 관리하고 표시할 지도 객체
	averageCenter: true, // 클러스터에 포함된 마커들의 평균 위치를 클러스터 마커 위치로 설정
	minLevel: 5 // 클러스터 할 최소 지도 레벨
});

var geocoder = new kakao.maps.services.Geocoder();
var currentOverlay = null;
var markers = [];
var markerCache = {}; // 마커 캐시
var searchZoomLevel = 13; // 검색 시 줌 레벨
var lastCenter = map.getCenter(); // 마지막 중심 좌표
var lastZoomLevel = map.getLevel(); // 마지막 줌 레벨

// 지도 이동 또는 줌 변경 시 현재 상태 저장
kakao.maps.event.addListener(map, 'center_changed', function () {
	lastCenter = map.getCenter();
	lastZoomLevel = map.getLevel();
});

$(document).ready(function () {
	$('#loading-bar').show(); // 로딩 바를 표시합니다

	$.ajax({
		type: "GET",
		dataType: "json",
		contentType: "application/json; charset=UTF-8;",
		url: "assets/data/data.json", // 데이터를 가져올 API 엔드포인트
		success: function (result) {
			DATA = result;
			processAddresses(DATA, function () {
				createMarkers(DATA);
				$('#loading-bar').hide(); // 로딩 바를 숨깁니다
			});
		},
		error: function (xhr, status, error) {
			$('#loading-bar').hide(); // 로딩 바를 숨깁니다
			console.error("데이터 가져오기 오류: ", error); // 에러를 콘솔에 출력합니다
		}
	});

	$('#search-input').on('input', function () {
		var searchText = $(this).val().toLowerCase();
		var filteredData = DATA.filter(function (item) {
			return item[0] && item[0].toLowerCase().includes(searchText);
		});
		createMarkers(filteredData);
		toggleClearButton();
		toggleNoResults(filteredData.length === 0);
		adjustZoomAndCenter(searchText);
	});

	$('#clear-button').on('click', function () {
		$('#search-input').val('');
		createMarkers(DATA); // 모든 마커를 다시 그립니다
		toggleClearButton();
		toggleNoResults(false);
		resetZoomAndCenter(); // 검색 전 상태로 복귀
	});

	toggleClearButton();
});

function processAddresses(data, callback) {
	var pending = data.length;
	if (pending === 0) {
		callback();
		return;
	}

	data.forEach(function (item) {
		if (item[2]) { // 주소가 있는지 확인
			if (markerCache[item[2]]) { // 캐시에 있는지 확인
				item.push(markerCache[item[2]]);
				if (--pending === 0) {
					callback();
				}
			} else {
				geocoder.addressSearch(item[2], function (geoResult, status) {
					if (status === kakao.maps.services.Status.OK) {
						var coords = new kakao.maps.LatLng(geoResult[0].y, geoResult[0].x);
						markerCache[item[2]] = coords;
						item.push(coords);
					} else {
						item.push(null); // 지오코딩 실패 시 null 추가
					}
					if (--pending === 0) {
						callback();
					}
				});
			}
		} else {
			item.push(null); // 주소가 없는 항목에 대해 null 추가
			if (--pending === 0) {
				callback();
			}
		}
	});
}

function createMarkers(data) {
	clusterer.clear(); // 기존 마커 제거
	markers = []; // 기존 마커 배열 초기화

	data.forEach(function (item) {
		var coords = item[item.length - 1]; // 좌표는 데이터의 마지막 요소
		if (coords) {
			var marker = new kakao.maps.Marker({
				position: coords
			});

			kakao.maps.event.addListener(marker, 'click', function () {
				if (currentOverlay) {
					currentOverlay.setMap(null);
				}
				var content = `
                    <div class="overlay">
                        <div class="close" onclick="closeOverlay()">✖</div>
                        <div class="info">
                            <p><strong>성명</strong> ${item[0]}</p>
                            <p><strong>나이</strong> ${item[1]}</p>
                            <p><strong>주소</strong> ${item[2]}</p>
                            <p><strong>임차보증금 반환채무</strong> ${item[3]}</p>
                            <p><strong>이행기</strong> ${item[4]}</p>
                            <p><strong>채무불이행기간</strong> ${item[5]}</p>
                            <p><strong>보증채무이행일</strong> ${item[6]}</p>
                            <p><strong>구상채무</strong> ${item[7]}</p>
                            <p><strong>강제집행 신청횟수</strong> ${item[8]}</p>
                            <p><strong>기준일</strong> ${item[9]}</p>
                        </div>
                    </div>
                `;
				var overlay = new kakao.maps.CustomOverlay({
					content: content,
					map: map,
					position: marker.getPosition()
				});
				currentOverlay = overlay;
				overlay.setMap(map);
			});

			markers.push(marker);
		}
	});

	clusterer.addMarkers(markers); // 클러스터러에 마커 추가
}

function toggleClearButton() {
	var input = $('#search-input');
	var clearButton = $('#clear-button');
	if (input.val()) {
		clearButton.addClass('visible');
	} else {
		clearButton.removeClass('visible');
	}
}

function toggleNoResults(show) {
	var noResults = $('#no-results');
	if (show) {
		noResults.show();
	} else {
		noResults.hide();
	}
}

function adjustZoomAndCenter(searchText) {
	if (searchText) {
		map.setLevel(searchZoomLevel); // 검색 시 줌 레벨 높이기
	} else {
		resetZoomAndCenter(); // 검색 전 상태로 복귀
	}
}

function resetZoomAndCenter() {
	map.setLevel(lastZoomLevel); // 마지막 줌 레벨로 복귀
	map.setCenter(lastCenter); // 마지막 중심 좌표로 복귀
}

function closeOverlay() {
	if (currentOverlay) {
		currentOverlay.setMap(null);
		currentOverlay = null;
	}
}
