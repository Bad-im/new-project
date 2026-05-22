# ML-пайплайн подготовки GeoTIFF

Этот каталог содержит отдельные скрипты подготовки датасета для FireForest Monitor. На этом шаге пайплайн только проверяет спутниковые снимки и нарезает их на геопривязанные патчи для будущего обучения модели.

Frontend и backend проекта не используются и не изменяются.

## Исходные данные

Исходные GeoTIFF-снимки лежат в папке:

```powershell
C:\labs\2024 год\г. Улан-Удэ,Иволгинский и Тарбагатайский район
```

Ожидается 7 каналов Sentinel:

1. B2
2. B3
3. B4
4. B5
5. B8
6. B11
7. B12

## Почему GeoTIFF

Патчи сохраняются как GeoTIFF, а не PNG/JPG, чтобы не терять значения пикселей, все 7 каналов, CRS и геопривязку. Если исходный снимок хранит данные как Float32, патчи тоже сохраняются с этим типом данных.

PNG-превью создаются только опционально для быстрой визуальной проверки и не являются обучающими данными.

## Установка зависимостей

```powershell
pip install -r ml/requirements-ml.txt
```

Зависимости ML-пайплайна намеренно вынесены отдельно и не добавляются в `backend/requirements.txt`.

## Инспекция GeoTIFF

Скрипт рекурсивно находит `.tif` и `.tiff`, проверяет размеры, число каналов, CRS, transform, bounds, nodata, dtype и оценивает количество патчей 256 и 512.

```powershell
python ml/scripts/inspect_geotiffs.py --input "C:\labs\2024 год\г. Улан-Удэ,Иволгинский и Тарбагатайский район" --output "C:\labs\Патчи\metadata\geotiff_inspection.csv"
```

## Тестовая нарезка

Тестовый запуск ограничивает количество сохраненных патчей на каждый исходный файл и создает PNG-превью RGB по каналам B4/B3/B2.

```powershell
python ml/scripts/cut_patches.py --input "C:\labs\2024 год\г. Улан-Удэ,Иволгинский и Тарбагатайский район" --output "C:\labs\Патчи" --metadata "C:\labs\Патчи\metadata\patches_metadata_test.csv" --patch-size 512 --stride 512 --min-valid-ratio 0.8 --recursive --max-patches-per-file 20 --preview-count 20
```

## Полная нарезка

Полную нарезку нужно запускать вручную после инспекции и тестового запуска.

```powershell
python ml/scripts/cut_patches.py --input "C:\labs\2024 год\г. Улан-Удэ,Иволгинский и Тарбагатайский район" --output "C:\labs\Патчи" --metadata "C:\labs\Патчи\metadata\patches_metadata.csv" --patch-size 512 --stride 512 --min-valid-ratio 0.8 --recursive
```

Патчи сохраняются в структуру:

```text
C:\labs\Патчи\patches\{source_name}\{source_name}_patch_{index:06d}.tif
```

Пропущенные окна записываются в:

```text
C:\labs\Патчи\metadata\skipped_patches.csv
```

## Размер патча 256 и 512

`patch_size=256` дает больше примеров и лучше подходит, если нужна более детальная локальная разметка. Такие патчи занимают меньше памяти каждый, но хуже захватывают широкий пространственный контекст.

`patch_size=512` дает меньше примеров, зато каждый патч содержит больше контекста вокруг участка лесной территории. Это хороший базовый вариант для первой подготовки датасета.

## Восстановление metadata для готовых патчей

Если GeoTIFF-патчи уже нарезаны, но metadata CSV был потерян или перезаписан, его можно восстановить напрямую из геопривязки самих `.tif` файлов.

Скрипт только читает патчи и создает CSV, изображения не изменяются:

```powershell
python ml/scripts/rebuild_patches_metadata.py --patches-root "C:\labs\Патчи_Full\patches" --output "C:\labs\Патчи_Full\metadata\rebuilt_patches_metadata_full.csv" --recursive
```

В metadata записываются `patch_id`, путь к патчу, папка-источник, размеры, число каналов, dtype, CRS, bounds, центр в EPSG:4326, размер пикселя, nodata и `valid_ratio`. Если CRS патча не EPSG:4326, центр преобразуется в lon/lat через `rasterio.warp.transform`.

Файлы, которые не удалось открыть или прочитать, не останавливают весь проход. Они записываются в отдельный CSV рядом с output:

```text
C:\labs\Патчи_Full\metadata\rebuilt_metadata_errors.csv
```

## Автоматическая разметка классов пожароопасности

После нарезки патчи можно автоматически разметить по слою классов пожарной опасности с портала `priroda-rb.ru`.

Скрипт:

```powershell
python ml/scripts/label_patches_from_priroda.py --metadata "C:\labs\Патчи_Full\metadata\kabansky_patches_metadata_full.csv" --output "C:\labs\Патчи_Full\metadata\kabansky_labels_test.csv" --limit 30 --delay 0.7 --mode five_points
```

Используется endpoint:

```text
POST https://priroda-rb.ru/api/feature_layer/identify
```

Нужный слой: `7201`.

Нужное поле в ответе: `fields["Класс"]`.

Координаты из metadata CSV ожидаются в EPSG:4326 (`center_lon`, `center_lat`, `bounds_left`, `bounds_bottom`, `bounds_right`, `bounds_top`). Перед запросом скрипт преобразует точки в EPSG:3857 через `pyproj` и строит вокруг каждой точки маленький квадрат, по умолчанию 20 метров.

По умолчанию используется режим `five_points`: проверяются центр патча и четыре внутренние угловые точки. Класс присваивается только при достаточном согласии точек (`--min-agreement 3`). Если класс не найден, в labels CSV записывается `hazard_class=skip` и `status=not_found`. Если точки дают разные классы без большинства, записывается `hazard_class=skip` и `status=mixed_points`. При ошибке сети строка не теряется: записывается `status=request_error`.

Для безопасного теста сначала запускайте ограниченный прогон на 20-30 патчах:

```powershell
python ml/scripts/label_patches_from_priroda.py --metadata "C:\labs\Патчи_Full\metadata\kabansky_patches_metadata_full.csv" --output "C:\labs\Патчи_Full\metadata\kabansky_labels_test.csv" --limit 30 --delay 0.7 --mode five_points
```

Полный запуск выполняйте вручную только после проверки тестового CSV:

```powershell
python ml/scripts/label_patches_from_priroda.py --metadata "C:\labs\Патчи_Full\metadata\kabansky_patches_metadata_full.csv" --output "C:\labs\Патчи_Full\metadata\kabansky_labels_auto.csv" --delay 0.7 --mode five_points --resume
```

Опция `--resume` пропускает уже размеченные `patch_id`, если выходной CSV существует. Опция `--save-raw-response` сохраняет сырые JSON-ответы в файл `*.raw_responses.jsonl` рядом с labels CSV для отладки.

Выходной labels CSV содержит:

```text
patch_id,patch_path,source_file,center_lon,center_lat,hazard_class,status,confidence,points_checked,points_with_class,class_votes,raw_classes,layer_id,source,created_at
```

Патчи с `hazard_class=skip` не используются при обучении модели.

## Следующий шаг

После автоматической разметки нужно вручную проверить небольшой сэмпл labels CSV и исключить строки `hazard_class=skip` из обучающей выборки. Обучение модели в этот пайплайн пока не добавляется.
