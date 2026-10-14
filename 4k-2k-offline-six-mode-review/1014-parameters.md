# 当前评审页三个工作流参数备注

日期：2026-10-14。对应当前原图／自然／暖／新冷四列页面，按实际运行API核对；统一60张。

| 参数 | 自然调 | 暖调 | 新冷调 |
|---|---|---|---|
| LoRA强度 | 0.65 | 0.8 | 0.65 |
| 色彩匹配通道 | ab | ab | ab |
| ab强度 | 1.0 | 0.8 | 0.6 |
| 亮度／对比度／饱和度节点 | 开启：1.0／1.0／1.03 | 旁路 | 旁路 |
| 色温节点 | 旁路 | 开启：-2 | 开启：3 |
| 提示词内白平衡／色温 | 无 | 4800k | 5000K |
| 采样 | Euler／2步／CFG1／seed42 | 相同 | 相同 |
| 实际运行环境 | prodtestfeat | 本地ComfyUI | prodtestfeat |
| 保存链路 | 48→54(ab)→57(饱和度)→71 | 48→54(ab)→58(色温)→71 | 48→54(ab)→58(色温)→71 |
| 最终文件 | JPG85、4:4:4；PNG原档保留 | 本地直接JPG85 | JPG85、4:4:4；PNG原档保留 |

三版负向提示词均为空。色温节点的数值-2／3不是开尔文；提示词中的4800k／5000K与节点参数分别记录。

尺寸与分块：原始宽、高各496–4000；Lanczos等比例统一最长边3840，小图也放大；补齐16倍数后分块，最终裁掉补边，保留缩放后的4K尺寸。窗口每边min(补边后尺寸,1536)，步距1024，羽化512；整图先生成seed42噪声再裁块，两步间融合。不输出过程预览。

## 自然调

正向提示词：

```text
zhiganEnhance
```

实际LoRA名称：`flux2_klein9B_zhiganEnhance_v2_000006000.safetensors`。

实际结果及UI/API模板目录：`C:\Users\admin\Downloads\20261013-4K自然调_LoRA065_饱和度103_线上测试准备`。

## 暖调

正向提示词：

```text
zhiganEnhance, keep all material colors and textures in the picture unchanged, color temperature 4800k
```

实际LoRA名称：`zhiganEnhance_v4_1006\zhigan_enhance_klein9b_1024_v4_8000_000006000.safetensors`。

实际结果及UI/API模板目录：`C:\Users\admin\Downloads\20261013-4K本地暖色调批量准备`。

## 新冷调

正向提示词：

```text
zhiganEnhance, enhance the spatial depth of the image, preserve shadow depth, keep all material colors and textures in the picture unchanged, no harsh exposure, avoid whitening, white balance 5000K, no grayish white look, eliminate overexposure of window shadows
```

实际LoRA名称：`flux2_klein9B_zhiganEnhance_v2_000006000.safetensors`。

实际结果及UI/API模板目录：`C:\Users\admin\Downloads\20261014-4K冷调_LoRA065_ab06_色温3_线上测试`。

## 之前部署的线上展示页链接

- 4K／2K离线六模式（各60组）：https://ameerahcl22979-chawen.github.io/image-review-report/4k-2k-offline-six-mode-review/?v=d083c1e
- 4K实时增强四列（100组，本地页面样式来源）：https://ameerahcl22979-chawen.github.io/image-review-report/4k-realtime-enhancement-review/?v=136b2d7

以上是之前已发布页面，内容为历史批次；当前三版新结果在本地8873页面，本轮仅整理参数与查找链接，没有更新线上页。

本地入口：http://127.0.0.1:8873/?v=20261014-four-newcold

参数来源：三批实际运行001_API.json及当前网页素材审计.json。网页图片技术核验完成；用户本轮确认当前页面内容，未形成逐图效果验收结论。
