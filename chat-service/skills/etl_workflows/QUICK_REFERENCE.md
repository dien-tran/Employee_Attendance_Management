# 📋 ETL Scenario Generation Skill - Quick Reference

**Tạo ngày**: May 6, 2026  
**Mục đích**: Phát sinh / cập nhật luồng ETL từ bộ kịch bản (use cases)

---

## 📂 File Được Tạo

### 1. **`ETL_SCENARIO_GENERATION.md`** (chính)
Hướng dẫn chi tiết về:
- ✅ Cấu trúc input kịch bản
- ✅ Quy trình phát sinh ETL (7 bước)
- ✅ Code patterns & template
- ✅ Cách organize output (`category_keyword/filename.md`)
- ✅ Naming conventions (DuckDB tables, file names)
- ✅ Lưu ý quan trọng & best practices

**Sử dụng**: Đọc khi muốn phát sinh ETL mới.

---

### 2. **`EXAMPLE_HR_ADMIN_IMPLEMENTATION.md`** (ví dụ)
Ví dụ thực tế áp dụng skill cho NHÓM 1 (HR & Organization):
- ✅ Parse 3 kịch bản của bạn (Staff by Department, Staff Status, Staff Lookup)
- ✅ Code skeleton cho mỗi scenario
- ✅ Implement đầy đủ transform logic
- ✅ Cập nhật `run_etl.py` và `MAP.md`
- ✅ Test command & expected output

**Sử dụng**: Tham khảo khi implement scenario tương tự.

---

### 3. **`README.md`** (entry point)
Tóm tắt và entry point cho skill:
- ✅ Overview tất cả files
- ✅ Navigation guide
- ✅ Quick start

**Sử dụng**: Bắt đầu từ đây.

---

## 🎯 Cách Sử Dụng

### Scenario A: Phát sinh ETL từ tập kịch bản mới

```
User: "Tạo cho tôi skill mới cho quá trình phát sinh ETL..."
        [cung cấp NHÓM + các Kịch bản]

Agent:
1. Mở: ETL_SCENARIO_GENERATION.md
2. Parse từng kịch bản theo "Cấu trúc Input"
3. Áp dụng "Quy trình Từng Bước" (steps 1-7)
4. Tạo code blocks trong etl_core.py
5. Cập nhật run_etl.py
6. Test & verify output
```

---

### Scenario B: Tham khảo cách làm cho nhóm tương tự

```
User: "Tôi muốn làm tương tự cho Payroll Analytics..."

Agent:
1. Mở: EXAMPLE_HR_ADMIN_IMPLEMENTATION.md
2. Hiểu flow của example (steps 1-7)
3. Adapt mục 1 (Parse) cho payroll scenarios
4. Adapt mục 3 (Implement) cho payroll tables
5. Copy pattern từ mục 4 (run_etl.py)
6. Apply test steps từ mục 6
```

---

## 📊 Mapping Kịch Bản → Code

```
Kịch bản Input
    ↓
[Parse Requirements]
    ↓
{
    scenario_name: "staff_by_department",
    sources: ["staffs", "structures"],
    duckdb_table: "analytics__staff_by_department",
    output: "hr_admin/staff_by_department.md"
}
    ↓
[Generate Code Skeleton]
    ↓
def build_staff_by_department_frames(self, staffs, structures):
    ...
    ↓
[Implement Transform Logic]
    ↓
[Add to run_etl.py]
    ↓
[Test & Verify]
    ↓
[Update MAP.md]
    ↓
✅ Complete
```

---

## 🔍 Checklist: Phát sinh ETL Mới

Khi implement một scenario mới, đảm bảo:

- [ ] **Parse**: Kịch bản đã được parse thành scenario metadata
- [ ] **Skeleton**: Code skeleton tạo trong `etl_core.py` (3 methods: build_, load_, export_)
- [ ] **Logic**: Transform logic implemented (với comments)
- [ ] **Integration**: Thêm call trong `run_etl.py`
- [ ] **Testing**: `python stats_refactored/run_etl.py` chạy thành công
- [ ] **Output**: Files được tạo ở path đúng: `category_keyword/filename.md`
- [ ] **Documentation**: Update `MAP.md` nếu cần
- [ ] **Validation**: Data format, row counts, schema validate

---

## 📚 Thư viện Patterns

### Transform Patterns

**1. Filter & Select**
```python
df = pd.DataFrame({
    'key': self._get_col(source, '_id').astype(str),
    'field1': self._get_col(source, 'field1'),
    'field2': self._get_col(source, 'field2'),
}).drop_duplicates(subset=['key'])
```

**2. Join (Left)**
```python
result = left_df.merge(
    right_df,
    on='join_key',
    how='left',
)
```

**3. Aggregate**
```python
summary = df.groupby('group_col', dropna=False).agg(
    count_val=('key', 'nunique'),
    sum_val=('amount', 'sum'),
).reset_index()
```

**4. Date Handling**
```python
df['date_col'] = pd.to_datetime(
    self._get_col(df, 'date_field'),
    errors='coerce'
)
```

**5. Status Classification**
```python
status_series = df['status'].astype(str).str.lower().str.strip()
df['is_active'] = status_series.isin(['active', 'working', 'current'])
```

---

## 🛠️ Directory Structure

Sau khi implement, structure sẽ giống:

```
stats_refactored/
├── collection_exports/      # Raw MongoDB collections
├── payroll_enrichment/      # Enriched joins
├── staffs_structures_analytics/
├── hr_admin/                # ← NEW: Category 1
│   ├── staff_by_department.md
│   ├── staff_status.md
│   └── staff_lookup.md
├── payroll_analytics/       # ← NEW (future): Category 2
│   └── ...
├── etl/
│   └── etl_core.py          # Updated with new methods
├── output/
├── MAP.md                   # Updated
└── run_etl.py              # Updated
```

---

## 🚀 Next Steps

1. **Bạn muốn phát sinh ETL cho nhóm nào tiếp theo?**
   - NHÓM 2: Payroll & Compensation?
   - NHÓM 3: Attendance & Leaves?
   - Khác?

2. **Cung cấp**:
   - Tên nhóm (Group name)
   - Danh sách bảng MongoDB liên quan
   - 2-3 kịch bản (scenarios) chi tiết
   
3. **Agent sẽ**:
   - Áp dụng skill `ETL_SCENARIO_GENERATION.md`
   - Tham khảo `EXAMPLE_HR_ADMIN_IMPLEMENTATION.md` cho pattern
   - Tạo code và test end-to-end

---

## 📖 Files to Read

| Tên File | Mục đích | Độ ưu tiên |
|----------|---------|----------|
| `README.md` | Entry point & overview | ⭐⭐⭐ |
| `ETL_SCENARIO_GENERATION.md` | Hướng dẫn chính | ⭐⭐⭐ |
| `EXAMPLE_HR_ADMIN_IMPLEMENTATION.md` | Ví dụ chi tiết | ⭐⭐⭐ |
| `QUICK_REFERENCE.md` | Quick lookup | ⭐⭐ |

---

## ✅ Summary

Bạn giờ đây có một **skill framework hoàn chỉnh** để:

✨ **Phát sinh ETL từ kịch bản**  
✨ **Organize output một cách chuẩn**  
✨ **Maintain consistency** trong codebase  
✨ **Scale up** dễ dàng cho các nhóm kịch bản mới  

**Ready to generate more scenarios!** 🎯
