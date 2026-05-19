# Agent Skill Guidance

Agent cần đọc hướng dẫn chi tiết cho các skill trong `skills/`.

## Skill Ưu Tiên Cho Bài Toán Chatbot HR

### 1. Wiki ETL Codegen (`wiki_etl_codegen/`) - ƯU TIÊN

**Mục đích**: Sinh ETL code phục vụ luồng câu hỏi tổng hợp theo hướng Wiki LLM.

**Contract bắt buộc**:
- Input: chỉ cần kịch bản (scenario)
- Output: ETL code (không dùng DuckDB)

**Khi sử dụng**:
- User yêu cầu build sẵn dữ liệu tổng hợp để giảm latency truy vấn runtime
- Kết quả cần xuất ra markdown/wiki tables để LLM tra cứu trực tiếp
- Không cần bước load vào data warehouse

**Chi tiết**:
- `skills/wiki_etl_codegen/README.md`
- `skills/wiki_etl_codegen/SCENARIO_TO_ETL_CODE.md`

---

### 2. Legacy ETL Workflows (`etl_workflows/`)

**Mục đích**: Bộ tài liệu ETL cũ có dùng DuckDB. Chỉ dùng khi user yêu cầu rõ ràng theo legacy flow.

**Chi tiết**:
- `skills/etl_workflows/README.md`
- `skills/etl_workflows/ETL_SCENARIO_GENERATION.md`
- `skills/etl_workflows/EXAMPLE_HR_ADMIN_IMPLEMENTATION.md`
- `skills/etl_workflows/QUICK_REFERENCE.md`

---

## Nguyên Tắc Chung

1. Luôn log rõ input kịch bản và giả định khi field thiếu.
2. Output code phải chạy độc lập, không hard-code dữ liệu mẫu.
3. Tách rõ `extract`, `transform`, `publish_markdown` để dễ test.
4. Giữ format markdown ổn định để retrieval deterministic.
5. Ưu tiên tốc độ đọc cho chatbot hơn độ phức tạp kỹ thuật.
