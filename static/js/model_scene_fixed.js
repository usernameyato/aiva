
const canvas = document.getElementById("renderCanvas");
const engine = new BABYLON.Engine(canvas, true);
engine.loadingScreenDivId = null;
engine.displayLoadingUI = () => {};
engine.hideLoadingUI = () => {};
const scene = new BABYLON.Scene(engine);
scene.clearColor = new BABYLON.Color3.Black();

const camera = new BABYLON.ArcRotateCamera("Camera", Math.PI / 2, Math.PI / 2.2, 4.5, new BABYLON.Vector3(0, 2.8, 0), scene);
camera.attachControl(canvas, true);

camera.inputs.removeByType("ArcRotateCameraMouseWheelInput");

// camera.lowerRadiusLimit = 2.5;
// camera.upperRadiusLimit = 5;
// camera.wheelDeltaPercentage = 0.01;

const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
light.intensity = 1.1;

//lypsinc morphs
let mouthOpenTarget = null;
let jawOpenTarget = null;
window.lipSyncTargets = {
  head: {},
  teeth: {}
};
function setMorph(name, value) {
  if (window.lipSyncTargets.head?.[name]) {
    window.lipSyncTargets.head[name].influence = value;
  }
  if (window.lipSyncTargets.teeth?.[name]) {
    window.lipSyncTargets.teeth[name].influence = value;
  }
}

function setMorphSmooth(name, targetValue, speed = 0.2) {
  const headTarget = window.lipSyncTargets.head?.[name];
  const teethTarget = window.lipSyncTargets.teeth?.[name];

  if (headTarget) {
    headTarget.influence += (targetValue - headTarget.influence) * speed;
  }
  if (teethTarget) {
    teethTarget.influence += (targetValue - teethTarget.influence) * speed;
  }
}






let animationGroups = [];

function playAnimationByName(name) {
    const target = animationGroups.find(group => group.name === name);
    if (!target) {
        console.warn("Анимация не найдена:", name);
        return;
    }
    animationGroups.forEach(group => group.stop());
    target.start(true);
    console.log("▶ Анимация:", name);
}

function createAnimationButtons() {
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.top = "10px";
    container.style.left = "10px";
    container.style.zIndex = "100";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "5px";
    document.body.appendChild(container);

    //lipsync test
    const lipTestBtn = document.createElement("button");
    lipTestBtn.textContent = "👄 Открыть рот";
    lipTestBtn.style.position = "absolute";
    lipTestBtn.style.bottom = "10px";
    lipTestBtn.style.left = "10px";
    lipTestBtn.style.zIndex = "100";
    document.body.appendChild(lipTestBtn);

    let isOpen = false;
    lipTestBtn.onclick = () => {
        if (!mouthOpenTarget || !jawOpenTarget) {
            console.warn("❌ Morph targets не найдены.");
            return;
        }

        isOpen = !isOpen;
        mouthOpenTarget.influence = isOpen ? 1.0 : 0.0;
        jawOpenTarget.influence = isOpen ? 0.8 : 0.0;
        mouthOpenTarget1.influence = isOpen ? 1.0 : 0.0;
        jawOpenTarget1.influence = isOpen ? 0.8 : 0.0;
        console.log(isOpen ? "👄 Рот открыт!" : "🤐 Рот закрыт");
    };




    animationGroups.forEach((group) => {
        const btn = document.createElement("button");
        btn.textContent = group.name;
        btn.onclick = () => playAnimationByName(group.name);
        container.appendChild(btn);
    });
}

BABYLON.SceneLoader.Append("/static/model/", "aiva_v5.glb", scene, function (scene) {
    console.log("✅ Модель загружена!");
    animationGroups = scene.animationGroups;
    const root = scene.meshes[0];
    root.scaling = new BABYLON.Vector3(2, 2, 2);

    camera.alpha += Math.PI;
    camera.radius = 2;

    scene.meshes.forEach(mesh => {
      if ((mesh.name.includes("Wolf3D_Head") || mesh.name.includes("Wolf3D_Teeth")) && mesh.morphTargetManager) {
        const targetSet = mesh.name.includes("Head") ? lipSyncTargets.head : lipSyncTargets.teeth;
        for (let i = 0; i < mesh.morphTargetManager.numTargets; i++) {
          const target = mesh.morphTargetManager.getTarget(i);
          if (target && target.name.startsWith("viseme_") || target.name === "mouthOpen" || target.name === "jawOpen") {
            targetSet[target.name] = target;
          }
        }
      }
    });



    console.log("🎞 Доступные анимации:");
    animationGroups.forEach(group => console.log("- " + group.name));

    scene.materials.forEach(material => {
        if (material.albedoTexture) {
            material.albedoTexture.hasAlpha = false;
            material.albedoTexture.updateSamplingMode(BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
        }
    });

    engine.enableDepthBuffer = true;
    engine.enableDepthWrite = true;

    playAnimationByName("idle");
    createAnimationButtons();

    let headMesh = scene.getMeshByName("Wolf3D_Head");
    let teethMesh = scene.getMeshByName("Wolf3D_Teeth");
    if (headMesh && headMesh.morphTargetManager) {
        const morphs = headMesh.morphTargetManager;
        mouthOpenTarget = morphs.getTargetByName("mouthOpen");
        jawOpenTarget = morphs.getTargetByName("jawOpen");

        console.log("🎯 mouthOpenTarget:", mouthOpenTarget);
        console.log("🎯 jawOpenTarget:", jawOpenTarget);
    }
    if (teethMesh && teethMesh.morphTargetManager) {
        const morphs = teethMesh.morphTargetManager;
        mouthOpenTarget1 = morphs.getTargetByName("mouthOpen");
        jawOpenTarget1 = morphs.getTargetByName("jawOpen");

        console.log("🎯 mouthOpenTarget:", mouthOpenTarget);
        console.log("🎯 jawOpenTarget:", jawOpenTarget);
    }

});



engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());
