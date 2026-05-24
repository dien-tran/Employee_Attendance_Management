# Wiki ETL Codegen Skill

## Mục tiêu

Skill này dùng để sinh ETL code cho luồng câu hỏi **tổng hợp** trong chatbot HR theo hướng Wiki LLM:

- Không generate query ở runtime.
- ETL dữ liệu nguồn thành markdown tables để chatbot tra cứu nhanh.
- Không dùng DuckDB.

## Contract

- Input: chỉ cần kịch bản (scenario).
- Output: ETL code hoàn chỉnh (extract -> transform -> publish markdown).

## Khi nào dùng skill này

Dùng khi câu hỏi thuộc loại tổng hợp như:
- "Tỷ lệ nghỉ việc theo phòng ban 6 tháng gần nhất?"
- "Top 10 bộ phận có tăng trưởng headcount cao nhất?"
- "Phân bố nhân sự theo level và location?"

Không dùng skill này cho câu hỏi tra cứu chi tiết từng bản ghi (dùng luồng query-time SQL).

## Output chuẩn mong đợi

Một file Python ETL theo scenario, gồm tối thiểu:

1. Hàm `extract_*` đọc dữ liệu nguồn.
2. Hàm `transform_*` xử lý tổng hợp.
3. Hàm `to_markdown_table` chuẩn hóa bảng markdown.
4. Hàm `publish_*` ghi file wiki markdown.
5. Hàm `run()` để chạy end-to-end.

## Tài liệu chính

- `skills/wiki_etl_codegen/SCENARIO_TO_ETL_CODE.md`
