FROM debian:bookworm-slim

WORKDIR /app

COPY video-editing-system-linux /app/video-editing-system

RUN chmod +x /app/video-editing-system

ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["/app/video-editing-system"]
