# ETL Scenario Generation Skill

**Mục đích**: Phát sinh / cập nhật các luồng ETL dựa trên tập kịch bản (use cases) được cung cấp.

---

## 1. Cấu trúc Input

### Format Kịch Bản (Scenario)

Mỗi nhóm kịch bản tuân theo cấu trúc:

```
NHÓM [N]: [Category Title] (Related Tables)
Mô tả chung về nhóm kịch bản.

Kịch bản [N.M]: [Scenario Name]
- Câu hỏi: "[User question example]"
- Xử lý: [ETL steps to process]
- Bảng nguồn (MongoDB): [collection1, collection2, ...]
- Bảng đích (DuckDB): [table_name]
- Output (Markdown): [category_keyword/filename.md]
```

### Ví dụ

```
NHÓM 1: NHÂN SỰ & QUẢN TRỊ CƠ CẤU (Bảng staffs & structures)
Tập trung vào tra cứu thông tin định danh và sơ đồ tổ chức.

Kịch bản 1.1: Tra cứu nhân viên theo phòng ban
- Câu hỏi: "Liệt kê danh sách nhân viên thuộc bộ phận Kinh Doanh."
- Xử lý: Truy vấn bảng staffs, lọc theo structure_id, join với structures để lấy tên phòng ban.
- Bảng nguồn: staffs, structures
- Bảng đích (DuckDB): analytics__staff_by_department
- Output: hr_admin/staff_by_department.md

Kịch bản 1.2: Kiểm tra trạng thái làm việc
- Câu hỏi: "Có bao nhiêu nhân viên đang còn hoạt động?"
- Xử lý: Đếm số lượng bản ghi staffs theo trường status (filter: active/working).
- Bảng nguồn: staffs
- Bảng đích (DuckDB): analytics__staff_status_counts
- Output: hr_admin/staff_status.md

Kịch bản 1.3: Tìm nhân viên theo mã số
- Câu hỏi: "Thông tin của nhân viên có mã DT100797?"
- Xử lý: Lọc bảng staffs theo staff_code, lookup trong structures.
- Bảng nguồn: staffs, structures
- Bảng đích (DuckDB): analytics__staff_lookup
- Output: hr_admin/staff_lookup.md
```

---

## 2. Quy trình Phát sinh ETL

### 2.1 Phân tích Yêu cầu

1. **Nhận diện nhóm kịch bản**:
   - Xác định category (ví dụ: NHÂN SỰ & QUẢN TRỊ CƠ CẤU).
   - Xác định các bảng liên quan từ MongoDB.

2. **Pháp tích từng kịch bản**:
   - Xác định bảng nguồn (MongoDB collections).
   - Xác định phép biến đổi cần thiết (filter, join, aggregate, etc).
   - Xác định bảng đích DuckDB.

3. **Tạo mapping đầu ra**:
   - `category_keyword`: slug từ category (ví dụ: `hr_admin`, `payroll_analytics`, etc).
   - `filename.md`: tên bảng hoặc tên join (ví dụ: `staff_by_department.md`, `staffs_contracts_enriched.md`).

### 2.2 Tạo ETL Code Block

Mỗi kịch bản phát sinh một code block trong `stats_refactored/etl/etl_core.py` hoặc một phương thức riêng trong ETL class.

**Pattern chung**:

```python
def build_<scenario_name>_frames(self, <input_dfs>) -> Dict[str, pd.DataFrame]:
    """
    <Scenario description>
    
    Input collections: <collection list>
    Output DuckDB tables: <table list>
    Markdown exports: <markdown paths>
    """
    # 1. Copy input để không thay đổi gốc
    df_local = input_df.copy()
    
    # 2. Áp dụng transforms (filter, join, aggregate, etc)
    # ... transformation logic ...
    
    # 3. Return dict với tên bảng DuckDB
    return {
        'analytics__<scenario>': output_df,
    }

def load_and_export_<scenario_name>(self, <scenario>_frames: Dict[str, pd.DataFrame]):
    """Load to DuckDB and export to Markdown."""
    for table_name, df in <scenario>_frames.items():
        self.write_duckdb_table(df, table_name)
    
    self.export_<scenario_name>_markdown(<scenario>_frames)

def export_<scenario_name>_markdown(self, <scenario>_frames: Dict[str, pd.DataFrame]):
    """Export to category_keyword/<filename>.md per MAP.md structure."""
    output_dir = self.out_dir.parent / '<category_keyword>'
    ensure_dir(output_dir)
    
    for frame_name, df in <scenario>_frames.items():
        md_path = output_dir / '<filename>.md'
        self._write_collection_style_markdown(
            table_name=frame_name,
            df=df,
            path=md_path
        )
```

### 2.3 Cập nhật `run_etl.py`

Thêm vào hàm `run_export()` để gọi các phương thức mới:

```python
def run_export(args):
    etl = ETL(...)
    
    # ... existing extracts ...
    
    # New scenario: HR & Organization
    staff_dept_analytics = etl.build_staff_by_department_frames(
        staffs=mongo_frames['staffs'],
        structures=mongo_frames['structures'],
    )
    etl.load_and_export_staff_by_department(staff_dept_analytics)
```

### 2.4 Tổ chức Đầu ra

Đảm bảo cấu trúc thư mục:

```
stats_refactored/
├── collection_exports/          # Raw MongoDB exports
│   ├── staffs.md
│   ├── contracts1.md
│   └── structures.md
├── payroll_enrichment/          # Semantic joins
│   └── staffs_contracts1.md
├── staffs_structures_analytics/ # Staff/org analytics
│   └── staffs_structures.md
├── <category_keyword>/          # NEW: Group scenarios
│   ├── <scenario1>.md
│   ├── <scenario2>.md
│   └── ...
└── etl/
    ├── etl_core.py              # ETL class (add new methods)
    ├── mongo_reader.py
    └── utils.py
```

---

## 3. Quy trình Từng Bước Để Agent Tuân Theo

### Khi nhận yêu cầu phát sinh ETL mới:

1. **Parse Kịch Bản**:
   ```
   - Đọc từng NHÓM [N] và xác định category_keyword
   - Cho mỗi Kịch bản [N.M]:
     a) Trích xuất: Câu hỏi, Xử lý, Bảng nguồn, Bảng đích, Output path
     b) Validate: MongoDB collections tồn tại? DuckDB table naming valid?
     c) Tạo mapping: scenario_name → file path
   ```

2. **Tạo Code Frame (Skeleton)**:
   ```python
   # Template cho mỗi kịch bản
   def build_<scenario_name>_frames(self, ...):
       # Transform logic
       pass
   
   def export_<scenario_name>_markdown(self, ...):
       # Markdown export
       pass
   ```

3. **Implement Transform Logic**:
   - Dựa vào bảng nguồn, áp dụng filter/join/aggregate
   - Sử dụng pattern từ `build_staff_structure_analytics_frames()` làm tham khảo
   - Để lại comments rõ ràng cho mỗi bước

4. **Thêm vào `run_etl.py`**:
   - Call `etl.build_<scenario>_frames()`
   - Call `etl.load_and_export_<scenario>()`
   - Thêm print statement để log tiến trình

5. **Test & Validate**:
   ```bash
   python stats_refactored/run_etl.py
   ```
   - Kiểm tra DuckDB tables được tạo
   - Kiểm tra Markdown files được export
   - Verify dữ liệu output đúng format

6. **Update MAP.md**:
   - Thêm mô tả cho directory mới (category_keyword)
   - List các scenarios bên trong

7. **Documentation**:
   - Cập nhật README nếu cần
   - Ghi log scenario mapping và file paths

---

## 4. Naming Convention

### Category Keywords (thư mục)
- `hr_admin` - HR & Organization (staffs, structures)
- `payroll_analytics` - Payroll & Compensation (contracts, salary)
- `attendance_analytics` - Attendance & Leaves
- `benefits_analytics` - Benefits & Insurance
- `kpi_analytics` - KPI & Performance metrics

### DuckDB Table Names
- `analytics__<scenario_name>` - Cho analytics/aggregations
- `analytics__<dimension>` - Cho dimension tables
- `analytics__<fact>` - Cho fact tables
- `enriched__<joined_name>` - Cho enriched/joined views

### File Names
- Tên bảng chuyển thành snake_case: `staff_by_department.md`
- Join tables: `staffs_contracts_enriched.md`
- Summary/aggregate: `staff_status_summary.md`

---

## 5. Lưu Ý Quan Trọng

1. **Không modify gốc DataFrame**: Luôn `.copy()` trước khi transform.

2. **Handle missing values**: Sử dụng `.fillna()`, `pd.to_datetime(..., errors='coerce')`, etc.

3. **Deduplication**: Sử dụng `.drop_duplicates(subset=['key_col'])` nếu cần.

4. **Performance**: Limit joins khi có thể; sử dụng `merge` với `on` parameter explicitly.

5. **Logging**: In tổng số rows, dữ liệu transform, output paths.

6. **Markdown exports**: Sử dụng `_write_collection_style_markdown()` để match format hiện có.

7. **Atomicity**: Ensure tất cả operations cho một scenario đều thành công hoặc roll back.

---

## 6. Template Quick Start

### Cho Agent:

```
Nhận được request phát sinh ETL mới:
1. Parse kịch bản input → extract (scenario_name, source_collections, duckdb_table, output_path)
2. Tạo skeleton code cho build_<scenario>_frames() trong etl_core.py
3. Implement transform logic (validate → transform → deduplicate)
4. Tạo export method cho markdown output
5. Thêm call trong run_etl.py
6. Test: python stats_refactored/run_etl.py
7. Verify output files tồn tại và có format đúng
8. Update MAP.md nếu cần
```

---

## 7. Example Implementation

Xem ví dụ đầy đủ:
- `stats_refactored/etl/etl_core.py`: `build_staff_structure_analytics_frames()`
- `stats_refactored/run_etl.py`: `run_export()` function call
- `stats_refactored/staffs_structures_analytics/staffs_structures.md`: sample output
