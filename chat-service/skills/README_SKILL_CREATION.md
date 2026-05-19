# Skill Update Summary (Chatbot HR)

## Bối cảnh bài toán

Hệ thống chatbot HR có 2 luồng để tối ưu latency:

1. Câu hỏi chi tiết: LLM generate query -> execute -> trả lời.
2. Câu hỏi tổng hợp: ETL sẵn thành wiki markdown -> LLM tra cứu trực tiếp.

## Thay đổi đã thực hiện

Đã tạo skill mới cho luồng (2), không dùng DuckDB:

- `skills/wiki_etl_codegen/README.md`
- `skills/wiki_etl_codegen/SCENARIO_TO_ETL_CODE.md`

Đã cập nhật điều hướng skill:

- `skills/AGENT_SKILL_GUIDANCE.md`
- `skills/INDEX.md`

## Contract của skill mới

- Input: chỉ cần kịch bản (scenario)
- Output: ETL code Python (extract -> transform -> publish markdown)

## Điểm khác với skill cũ

- Bỏ hoàn toàn DuckDB trong flow mới.
- Tập trung vào artifact markdown để phục vụ Wiki LLM.
- Giảm số file, chỉ giữ tài liệu cốt lõi.

## Cách dùng nhanh

```text
Sinh ETL code từ kịch bản sau (không dùng DuckDB):
[dán kịch bản]
```

Skill sẽ trả ETL code với assumptions nếu input thiếu field.
