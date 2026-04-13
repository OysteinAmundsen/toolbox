## Performance Regression Report

### Summary

- **Metrics**: ❌ **3 failures** · ✅ **2 passes** · 22 total
- **Other**: 17 (new/missing/skipped)
- **Baseline**: 2026-04-12
- **Threshold**: 50% regression

### Regressions & Notable Changes

| Metric | Status | Current | Baseline | Change |
|--------|--------|--------:|---------:|-------:|
| ❌ vanilla.scrollAvg | FAIL | 35.88ms | 18.52ms | +94% |
| ❌ vanilla.scrollP95 | FAIL | 75.5ms | 28.2ms | +168% |
| ❌ vanilla.scrollP99 | FAIL | 77.2ms | 28.8ms | +168% |
| ✅ vanilla.stressScrollAvg | pass | 19.91ms | 38.18ms | -48% |

