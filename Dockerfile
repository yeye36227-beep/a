# 정적 웹사이트(HTML/CSS/JS)를 nginx로 서빙하는 컨테이너
FROM nginx:alpine

# 프로젝트 파일을 nginx 기본 웹 루트로 복사
COPY . /usr/share/nginx/html

# nginx는 80 포트로 서비스
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
