-- 백엔드가 쓰는 DB 이름은 likelion 이므로 wiki -> likelion 으로 변경함
-- ★ 한글 깨짐 방지: 이 파일을 어떤 클라이언트로 넣든 세션 문자셋을 utf8mb4로 강제.
--   (latin1로 적재되면 한글이 깨져서 저장되므로 반드시 필요)
SET NAMES utf8mb4;
SET character_set_client = utf8mb4;
SET character_set_connection = utf8mb4;
SET character_set_results = utf8mb4;

USE likelion;

-- DB 기본 문자셋도 utf8mb4로 보정(테이블이 이후 생성될 때 상속)
ALTER DATABASE likelion CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ==============================
-- 초기화 (재실행 시 중복 에러 방지용, FK 순서 무시하고 전부 비움)
-- ==============================
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE exam_archive_view;
TRUNCATE TABLE exam_archive;
TRUNCATE TABLE review_report;
TRUNCATE TABLE review;
TRUNCATE TABLE tag_click;
TRUNCATE TABLE tag;
TRUNCATE TABLE refresh_tokens;
TRUNCATE TABLE file;
TRUNCATE TABLE users;
TRUNCATE TABLE subject;
TRUNCATE TABLE professor;
TRUNCATE TABLE department;
SET FOREIGN_KEY_CHECKS = 1;

-- ==============================
-- department
-- ==============================
INSERT INTO department (name) VALUES
('컴퓨터공학과'),
('간호학과'),
('의예과'),
('물리치료학과'),
('경영학과');

-- ==============================
-- professor (department_id: 1~5 순서대로 위 department와 매칭)
-- ==============================
INSERT INTO professor (name, department_id) VALUES
('김철수', 1),
('이영희', 1),
('박민수', 2),
('최지우', 2),
('정하늘', 3),
('강수진', 3),
('윤도현', 4),
('임서연', 4),
('한지민', 5),
('오세훈', 5);

-- ==============================
-- subject (professor_id: 1~10)
-- ==============================
INSERT INTO subject (name, professor_id) VALUES
('자료구조', 1),
('알고리즘', 1),
('데이터베이스', 2),
('운영체제', 2),
('기본간호학', 3),
('성인간호학', 3),
('아동간호학', 4),
('지역사회간호학', 4),
('해부학', 5),
('생리학', 5),
('병리학', 6),
('약리학', 6),
('운동치료학', 7),
('물리치료평가', 7),
('신경계물리치료', 8),
('근골격계물리치료', 8),
('경영학원론', 9),
('마케팅관리', 9),
('회계원리', 10),
('재무관리', 10);

-- ==============================
-- users (전부 비밀번호 password1234, BCrypt 해시)
-- ==============================
INSERT INTO users (username, password, name, nickname, phone, point, role, created_at) VALUES
('student1@eulji.ac.kr', '$2a$10$lcnprK7lvVtMG23I.NSDYufg1ACG7Sz1.6cRzjxds34Lkz0eZx9hO', '홍길동', '길동이', '01011112222', 35, 'USER', '2026-06-01 10:00:00'),
('student2@eulji.ac.kr', '$2a$10$lcnprK7lvVtMG23I.NSDYufg1ACG7Sz1.6cRzjxds34Lkz0eZx9hO', '김민준', '민준이', '01022223333', 25, 'USER', '2026-06-02 11:00:00'),
('student3@eulji.ac.kr', '$2a$10$lcnprK7lvVtMG23I.NSDYufg1ACG7Sz1.6cRzjxds34Lkz0eZx9hO', '이서연', '서연이', '01033334444', 20, 'USER', '2026-06-03 12:00:00'),
('student4@eulji.ac.kr', '$2a$10$lcnprK7lvVtMG23I.NSDYufg1ACG7Sz1.6cRzjxds34Lkz0eZx9hO', '박지호', '지호', '01044445555', 42, 'USER', '2026-06-04 13:00:00'),
('student5@eulji.ac.kr', '$2a$10$lcnprK7lvVtMG23I.NSDYufg1ACG7Sz1.6cRzjxds34Lkz0eZx9hO', '최수아', '수아', '01055556666', 20, 'USER', '2026-06-05 14:00:00'),
('student6@eulji.ac.kr', '$2a$10$lcnprK7lvVtMG23I.NSDYufg1ACG7Sz1.6cRzjxds34Lkz0eZx9hO', '정우진', '우진이', '01066667777', 28, 'USER', '2026-06-06 15:00:00'),
('student7@eulji.ac.kr', '$2a$10$lcnprK7lvVtMG23I.NSDYufg1ACG7Sz1.6cRzjxds34Lkz0eZx9hO', '한소율', '소율이', '01077778888', 20, 'USER', '2026-06-07 16:00:00'),
('student8@eulji.ac.kr', '$2a$10$lcnprK7lvVtMG23I.NSDYufg1ACG7Sz1.6cRzjxds34Lkz0eZx9hO', '윤시우', '시우', '01088889999', 33, 'USER', '2026-06-08 17:00:00'),
('student9@eulji.ac.kr', '$2a$10$lcnprK7lvVtMG23I.NSDYufg1ACG7Sz1.6cRzjxds34Lkz0eZx9hO', '임하은', '하은이', '01099990000', 20, 'USER', '2026-06-09 18:00:00'),
('admin@eulji.ac.kr', '$2a$10$lcnprK7lvVtMG23I.NSDYufg1ACG7Sz1.6cRzjxds34Lkz0eZx9hO', '관리자', '어드민', '01000001111', 20, 'ADMIN', '2026-06-01 09:00:00');

-- users 순서대로 생성된 user_id: 1~9 학생(student1~9), 10 관리자(admin)

-- ==============================
-- tag
-- ==============================
INSERT INTO tag (name) VALUES
('출결 엄격함'),
('출결 널널함'),
('시험 어려움'),
('과제 많음'),
('학점 후함'),
('설명 잘함'),
('팀플 많음');

-- tag_id: 1~7 순서대로 위 목록과 매칭

-- ==============================
-- tag_click (user_id, professor_id, tag_id) - 조합 중복 불가
-- ==============================
INSERT INTO tag_click (user_id, professor_id, tag_id, created_at) VALUES
(1, 1, 1, '2026-06-10 09:10:00'),
(1, 1, 4, '2026-06-10 09:11:00'),
(2, 1, 6, '2026-06-10 10:00:00'),
(3, 2, 5, '2026-06-11 11:00:00'),
(3, 2, 2, '2026-06-11 11:01:00'),
(4, 3, 1, '2026-06-12 12:00:00'),
(4, 3, 3, '2026-06-12 12:01:00'),
(5, 4, 7, '2026-06-13 13:00:00'),
(6, 5, 6, '2026-06-14 14:00:00'),
(6, 5, 4, '2026-06-14 14:01:00'),
(7, 7, 2, '2026-06-15 15:00:00'),
(8, 8, 5, '2026-06-16 16:00:00'),
(9, 9, 3, '2026-06-17 17:00:00'),
(1, 10, 6, '2026-06-18 18:00:00'),
(2, 10, 1, '2026-06-18 18:05:00');

-- ==============================
-- review (user_id, subject_id) - 조합 중복 불가. subject.professor_id와 review.professor_id 일치시킴
-- subject_id 1,2->professor1 / 3,4->professor2 / 5,6->professor3 / 7,8->professor4 / 9,10->professor5
-- subject_id 11,12->professor6 / 13,14->professor7 / 15,16->professor8 / 17,18->professor9 / 19,20->professor10
-- ==============================
INSERT INTO review (user_id, professor_id, subject_id, content, created_at) VALUES
(1, 1, 1, '과제가 많지만 실습 위주라 도움이 많이 됐어요.', '2026-06-20 09:00:00'),
(2, 1, 2, '설명을 정말 잘 해주셔서 이해하기 편했습니다.', '2026-06-20 10:00:00'),
(3, 2, 3, '시험이 어려운 편이라 미리 준비하는 게 좋아요.', '2026-06-21 11:00:00'),
(4, 3, 5, '실습 평가 기준이 명확해서 좋았어요.', '2026-06-22 12:00:00'),
(5, 4, 7, '팀플이 많은데 조원 편성은 자율이라 부담됩니다.', '2026-06-23 13:00:00'),
(6, 5, 9, '해부학 기초를 탄탄하게 잡아주시는 강의였어요.', '2026-06-24 14:00:00'),
(7, 6, 11, '학점을 후하게 주시는 편이라 부담이 적었어요.', '2026-06-25 15:00:00'),
(8, 7, 13, '출결 체크가 엄격한 편이니 지각하지 않는 게 좋아요.', '2026-06-26 16:00:00'),
(9, 8, 15, '실습 위주 수업이라 직접 해보면서 배울 수 있어요.', '2026-06-27 17:00:00'),
(1, 9, 17, '경영학 기초 개념을 쉽게 설명해주셨어요.', '2026-06-28 18:00:00'),
(2, 10, 19, '회계 기초부터 차근차근 알려주셔서 좋았습니다.', '2026-06-29 19:00:00'),
(3, 1, 1, '과제량이 많은 편이지만 배우는 게 많아요.', '2026-06-30 20:00:00');

-- review 순서대로 생성된 review_id: 1~12 (작성자는 위 INSERT 순서의 user_id와 동일)

-- ==============================
-- review_report (review_id, reporter_id) - 조합 중복 불가, 작성자 본인은 신고자로 넣지 않음
-- ==============================
INSERT INTO review_report (review_id, reporter_id, reason, created_at) VALUES
(5, 6, '수업과 무관한 부적절한 내용이 포함되어 있습니다.', '2026-07-01 09:00:00'),
(8, 2, '사실과 다른 내용이 작성되어 있습니다.', '2026-07-02 10:00:00');

-- ==============================
-- exam_archive (user_id, professor_id, title, content)
-- ==============================
INSERT INTO exam_archive (user_id, professor_id, title, content, created_at) VALUES
(1, 1, '2025-2학기 자료구조 중간고사 정리', '트리, 그래프 위주로 출제되었고 구현 문제 비중이 높았습니다.', '2026-05-01 09:00:00'),
(2, 1, '2025-2학기 알고리즘 기말고사 정리', '동적계획법과 그리디 알고리즘 문제가 주로 나왔어요.', '2026-05-02 10:00:00'),
(3, 2, '2025-2학기 데이터베이스 중간고사 정리', '정규화와 SQL 작성 문제 위주였습니다.', '2026-05-03 11:00:00'),
(4, 3, '2025-2학기 기본간호학 실기시험 정리', '활력징후 측정과 무균술 술기 위주로 평가했습니다.', '2026-05-04 12:00:00'),
(5, 5, '2025-2학기 해부학 기말고사 정리', '골격계와 근육계 명칭 암기가 핵심이었습니다.', '2026-05-05 13:00:00'),
(6, 7, '2025-2학기 운동치료학 중간고사 정리', '치료 원리와 적응증을 묻는 서술형이 많았습니다.', '2026-05-06 14:00:00'),
(7, 9, '2025-2학기 경영학원론 기말고사 정리', '경영 전략 사례 분석 문제가 출제되었습니다.', '2026-05-07 15:00:00'),
(8, 10, '2025-2학기 회계원리 중간고사 정리', '분개와 재무제표 작성 문제 위주였습니다.', '2026-05-08 16:00:00');

-- exam_archive 순서대로 생성된 exam_archive_id: 1~8

-- ==============================
-- exam_archive_view (user_id, exam_archive_id) - 조합 중복 불가
-- ==============================
INSERT INTO exam_archive_view (user_id, exam_archive_id, viewed_at) VALUES
(2, 1, '2026-06-10 09:00:00'),
(3, 1, '2026-06-10 09:05:00'),
(4, 2, '2026-06-11 10:00:00'),
(1, 3, '2026-06-12 11:00:00'),
(6, 4, '2026-06-13 12:00:00'),
(7, 5, '2026-06-14 13:00:00'),
(8, 6, '2026-06-15 14:00:00'),
(9, 7, '2026-06-16 15:00:00'),
(1, 8, '2026-06-17 16:00:00');

-- ==============================
-- file (참고용 더미. 실제로 FileController는 아직 없어서 애플리케이션이 만든 데이터는 아님)
-- ==============================
INSERT INTO file (uploader_id, original_name, stored_name, file_url, content_type, file_size, created_at, deleted_at) VALUES
(1, '수강확인서_홍길동.pdf', '3f2a9c1d-1111-4aaa-9999-000000000001', 'https://likelion-mini-project.s3.ap-northeast-2.amazonaws.com/enrollment-confirmation/1/3f2a9c1d-1111-4aaa-9999-000000000001', 'application/pdf', 245678, '2026-06-15 09:00:00', NULL),
(2, '수강확인서_김민준.pdf', '3f2a9c1d-2222-4bbb-9999-000000000002', 'https://likelion-mini-project.s3.ap-northeast-2.amazonaws.com/enrollment-confirmation/2/3f2a9c1d-2222-4bbb-9999-000000000002', 'application/pdf', 198342, '2026-06-16 10:00:00', NULL);

-- ==============================
-- refresh_tokens (user_id unique, 실제 유효한 JWT는 아니고 형태만 맞춘 더미 문자열)
-- ==============================
INSERT INTO refresh_tokens (user_id, token, created_at) VALUES
(1, 'dummy.refresh.token.for.user1.eyJhbGciOiJIUzI1NiJ9.placeholder-not-a-real-jwt', '2026-07-01 09:00:00'),
(2, 'dummy.refresh.token.for.user2.eyJhbGciOiJIUzI1NiJ9.placeholder-not-a-real-jwt', '2026-07-01 10:00:00'),
(10, 'dummy.refresh.token.for.admin.eyJhbGciOiJIUzI1NiJ9.placeholder-not-a-real-jwt', '2026-07-01 11:00:00');
