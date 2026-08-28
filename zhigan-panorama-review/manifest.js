window.REVIEW_MANIFEST_DATA = (() => {
  const placeholder = {
    workflow_c: "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1600' height='800' viewBox='0 0 1600 800'%3E%3Crect width='1600' height='800' fill='%23e1dcf6'/%3E%3Cg fill='none' stroke='rgba(255,255,255,.55)' stroke-width='2'%3E%3Cpath d='M0 280 C220 220 360 380 560 320 S920 170 1120 250 S1400 360 1600 290'/%3E%3Cpath d='M0 480 C240 530 380 380 610 430 S990 590 1210 490 S1430 360 1600 420'/%3E%3C/g%3E%3Ctext x='80' y='110' font-size='54' font-family='Arial,Microsoft YaHei,sans-serif' font-weight='700' fill='%23584985'%3EWorkflow C%3C/text%3E%3Ctext x='80' y='178' font-size='28' font-family='Arial,Microsoft YaHei,sans-serif' fill='%23584985' opacity='.75'%3EPlaceholder panorama preview%3C/text%3E%3C/svg%3E"
  };

  const columns = [
    ["original", "原始图"],
    ["workflow_a", "原效果"],
    ["workflow_b", "测试效果"]
  ];

  const scenes = [];
  for (let i = 1; i <= 20; i += 1) {
    const n = String(i).padStart(3, "0");
    scenes.push({
      id: `scene-${n}`,
      categoryId: "panorama",
      categoryName: "全景测试",
      group: i,
      number: i,
      sourceName: n,
      images: {
        ...placeholder,
        original: `./assets/original/${n}-original.jpg`,
        workflow_a: `./assets/original-effect-preview/${n}-original-effect.jpg`,
        workflow_b: `./assets/test-effect-preview/${n}-test-effect.jpg`
      },
      thumbs: {
        ...placeholder,
        original: `./assets/original/${n}-original.jpg`,
        workflow_a: `./assets/original-effect/${n}-original-effect.jpg`,
        workflow_b: `./assets/test-effect/${n}-test-effect.jpg`
      }
    });
  }

  return {
    meta: {
      title: "全景图质感增强效果对比",
      modelNote: "共 20 组，前 10 组为 4K 顺序，后 10 组为 6K 顺序，页面内不额外区分。",
      dataset: "panorama-review",
      sceneCount: scenes.length,
      imageCount: scenes.length * columns.length,
      missingCount: 0
    },
    columns,
    categories: [{ id: "panorama", name: "全景图", output: "panorama" }],
    scenes
  };
})();
