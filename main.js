/*

    the program starts by getting the canvas and then asking the canvas for a
    webgl context. after that the order is important:

    1. read the shader text from the html
    2. create a vertex shader and a fragment shader
    3. compille each shader
    4. create a program and attach both shaders
    5. link the program
    6. use the program
    7. find the attribute and uniform locations
    8. create and bind a bufffer
    9. describe the buffer to the vertex attribbute
    10. upload positions, set uniforms, and draw

    this is the basic webgl pipeline. webgl does not know what a bed or sofa
    is. it only knows vertices, buffers, shaders, matrices and draw calls.

    the first version of this project tried to do trnaslation by changing
    every vertex manually with objectx and objecty. that worked for one
    object, but it became hard to repeat for rotation and scaling. the old
    manual attempt is still left at the bottom of this file for learning.

    then we tried making translationmatrix() and rotationmatrix() by hand.
    matrices are written in colum major order for webgl. the translation
    values are in the last column when the matrix is shown as a 4 by 4 grid.

    finally gl-matrix was used. the object points stay in local co-ordinates
    and the matrix moves them into the world. the useful order is t r s:

        worldpoint = translation * rotation * scale * localpoint

    scale happens around the objects local origin, rotation happens around
    that same origin, and translation places the finished object in the room.
    if the order is wrong, the object can scale its position toward zero or
    rotate around the room instead of around itself.

    the html shader has a_position as an attribbute because every vertex has a
    different position. the matrix and color are uniforms because one value
    is sent for the complete draw call. this is the evolution from javascript
    variables to shader uniforms: instead of baking objectx into every
    vertex, javascript sends u_matrix and the vertex shader applies it.
*/
const { mat4 } = glMatrix;

const canvas = document.getElementById("glCanvas");
const objectInfo = document.getElementById("objectInfo");
const hitboxToggle = document.getElementById("hitboxToggle");
const modeSelect = document.getElementById("modeSelect");
const planName = document.getElementById("planName");
const savePlanButton = document.getElementById("savePlan");
const savedPlans = document.getElementById("savedPlans");
const loadPlanButton = document.getElementById("loadPlan");
const randomizeButton = document.getElementById("randomizeButton");
const labelInput = document.getElementById("labelInput");
const assignLabelButton = document.getElementById("assignLabel");
const selectionText = document.getElementById("selectionText");
let selectedObject = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let hitboxesVisible = false;
let currentMode = "plan";
function mouseToWorld(event) {
    const rect = canvas.getBoundingClientRect();

    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const x = (mouseX / rect.width) * 8 - 4;
    const y = 4 - (mouseY / rect.height) * 8;

    return { x, y };
}



//rotation is intentionally ignored here for initial testing
function isPointInsideObject(mouseX, mouseY, bounds) {
    return (
        mouseX >= bounds.left &&
        mouseX <= bounds.right &&
        mouseY >= bounds.bottom &&
        mouseY <= bounds.top
    );
}



// getcontext gives us the webgl object that contains all the gl calls and comand.
const gl = canvas.getContext("webgl");

if(!gl) {
    console.log("WebGL is not supported");
}
else{
    console.log("WebGL is supporteed");
}

gl.clearColor(0.9, 0.9, 0.9, 1.0); //setting the color
gl.clear(gl.COLOR_BUFFER_BIT); // actually clearing and setting the color

// passing vertex data: the shader source is writen inside the html script tags
const vertexShaderSource = document.getElementById("vertex-shader").textContent;
const fragmentShaderSource = document.getElementById("fragment-shader").textContent;



// function to create a shader: source -> compile -> shader object
function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
}

//matrix for translation they are in column major order, we will switch to the matrix library
// function translationmatrix(x, y) {
//     return new float32array([
//     1, 0, 0, 0,
//     0, 1, 0, 0,
//     0, 0, 1, 0,
//     x, y, 0, 1
// ]);
// }

// function rotationmatrix(angle) {
//     const c = math.cos(angle);
//     const s = math.sin(angle);

//     return new float32array([
//         c, -s, 0, 0,
//         s, c, 0, 0,
//         0, 0, 1, 0,
//         0, 0, 0, 1
//     ]);
// }

function createRectangle(width, height) {
        // rectangle points are local: the matrix will do the world movement later
    const x = width / 2;
    const y = height / 2;

    return new Float32Array([
        -x,  y,
         x,  y,
        -x, -y,

         x,  y,
         x, -y,
        -x, -y
    ]);
}

function createCircle(radius, segments = 32) {
        // center point plus ring points makes a filled circle with triangle_fan
    const points = [0, 0];

    for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        points.push(radius * Math.cos(angle), radius * Math.sin(angle));
    }

    return new Float32Array(points);
}

function createArc(radius, startAngle, endAngle, segments = 20) {
        // arc is only a line of points, not a filled shape
    const points = [];

    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const angle = startAngle + t * (endAngle - startAngle);

        points.push(
            radius * Math.cos(angle),
            radius * Math.sin(angle)
        );
    }

    return new Float32Array(points);
}



const matrix = mat4.create();

const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

// now we have compilled shaders, time to combine them in one program

const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);

gl.linkProgram(program); // something like combining and compiling them together


gl.useProgram(program); // calling it, but we havent passed the vec2 for a_position yet

// find the attribute for vec2 a_position and the unifrom addresses
const positionLocation = gl.getAttribLocation(program, "a_position");
const matrixLocation = gl.getUniformLocation(program, "u_matrix");
const colorLocation = gl.getUniformLocation(program, "u_color");
const projectionLocation = gl.getUniformLocation(program, "u_projection");
// now we create a buffer for this vertex data
const positionBuffer = gl.createBuffer();
// binding means this buffer becomes the current array_buffer
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);


gl.enableVertexAttribArray(positionLocation);
gl.vertexAttribPointer(
    positionLocation,
    2,
    gl.FLOAT,
    false,
    0,
    0
);

// the attribute setup is done once. later bufferdata replaces the points in
// the currently bound buffer, and the shader reads two floats per vertex.

const projectionMatrix = mat4.create();

mat4.ortho(
    projectionMatrix,
    -4, 4,   // left, right
    -4, 4,   // bottom, top
    -1, 1   // near, far
);

// send the camera-like projetion matrix to the shader unifrom
gl.uniformMatrix4fv(projectionLocation, false, projectionMatrix);

// gl.bindbuffer(gl.array_buffer, positionbuffer);
function drawRectangle({width, height, x, y, rotation, scaleX, scaleY, color: {r, g, b, a}}) {
    // create local points, upload them, make t-r-s, set unifroms, then draw
    const positions = createRectangle(width, height);
    // gl.bindbuffer(gl.array_buffer, positionbuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const matrix = mat4.create();
    mat4.translate(matrix, matrix, [x, y, 0]);
    mat4.rotateZ(matrix, matrix, rotation); 
    mat4.scale(matrix, matrix, [scaleX, scaleY, 1]);
    gl.uniformMatrix4fv(matrixLocation, false, matrix);
    gl.uniform4f(colorLocation, r, g, b, a);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function drawArc(radius, x, y, rotation, swingAngle, scaleX = 1, scaleY = 1, color) {

        // upload local arc points, then t-r-s the arc around its door henge
    const positions = createArc(
        radius,
        0,
        swingAngle
    );

    gl.bufferData(
        gl.ARRAY_BUFFER,
        positions,
        gl.STATIC_DRAW
    );

    const matrix = mat4.create();

    mat4.translate(matrix, matrix, [x, y, 0]);
    mat4.rotateZ(matrix, matrix, rotation);
    mat4.scale(matrix, matrix, [scaleX, scaleY, 1]);

    gl.uniformMatrix4fv(
        matrixLocation,
        false,
        matrix
    );

    gl.uniform4f(
        colorLocation,
        color.r,
        color.g,
        color.b,
        color.a
    );

    gl.drawArrays(
        gl.LINE_STRIP,
        0,
        positions.length / 2
    );
}

function drawLine(x1, y1, x2, y2, color) {

        // lines do not need a model matrix becuase the points are already world points
    const positions = new Float32Array([
        x1, y1,
        x2, y2
    ]);

    gl.bufferData(
        gl.ARRAY_BUFFER,
        positions,
        gl.STATIC_DRAW
    );

    // don't apply the previous object's transformation
    const matrix = mat4.create();

    gl.uniformMatrix4fv(
        matrixLocation,
        false,
        matrix
    );

    gl.uniform4f(
        colorLocation,
        color.r,
        color.g,
        color.b,
        color.a
    );

    gl.drawArrays(gl.LINES, 0, 2);
}



// let objectx = 0.4;
// let objecty = 0.2;

// let scalex = 0.5;
// let scaley = 0.5;

// let angle = math.pi/3;
function localToWorld(parent, localX, localY) {
    const cos = Math.cos(parent.rotation);
    const sin = Math.sin(parent.rotation);
    const scaleX = Number.isFinite(parent.scaleX) ? parent.scaleX : 1;
    const scaleY = Number.isFinite(parent.scaleY) ? parent.scaleY : 1;
    const scaledX = localX * scaleX;
    const scaledY = localY * scaleY;

    return {
        x: parent.x + cos * scaledX - sin * scaledY,
        y: parent.y + sin * scaledX + cos * scaledY
    };
}

function drawBed(bed) {

    // mattress
    drawRectangle({
        width: 1.0,
        height: 1.6,
        x: bed.x,
        y: bed.y,
        rotation: bed.rotation,
        scaleX: bed.scaleX,
        scaleY: bed.scaleY,
    color: {
        r: 1,
        g: 1,
        b: 1,
        a: 1.0
    }    });

    // pillow's position relative to bed
const pillowPosition = localToWorld(bed, -0.24, 0.67);
const pillowPosition2 = localToWorld(bed, 0.24, 0.67);
    drawRectangle({
        width: 0.45,
        height: 0.3,
        x: pillowPosition.x,
        y: pillowPosition.y,
        rotation: bed.rotation,
        scaleX: bed.scaleX,
        scaleY: bed.scaleY,
    color: {
        r: 0.5,
        g: 0.7,
        b: 0.8,
        a: 1.0
    }
    });


    drawRectangle({
    width: 0.45,
    height: 0.3,
    x: pillowPosition2.x,
    y: pillowPosition2.y,
    rotation: bed.rotation,
    scaleX: bed.scaleX,
    scaleY: bed.scaleY,

    color: {
       r: 0.5,
        g: 0.7,
        b: 0.8,
        a: 1.0
    }
});

    const blanketPosition = localToWorld(bed, 0, -0.4);

drawRectangle({
    width: 1.0,
    height: 0.8,
    x: blanketPosition.x,
    y: blanketPosition.y,
    rotation: bed.rotation,
    scaleX: bed.scaleX,
    scaleY: bed.scaleY,
    color: {
        r: 0.4,
        g: 0.6,
        b: 0.8,
        a: 1.0
    }
});
}

function drawSofa(sofa) {

    // seat
    drawRectangle({
        width: 1.6,
        height: 0.7,
        x: sofa.x,
        y: sofa.y,
        rotation: sofa.rotation,
        scaleX: sofa.scaleX,
        scaleY: sofa.scaleY,
        color: {
            r: 0.55,
            g: 0.35,
            b: 0.2,
            a: 1.0
        }
    });

    // back
    const backPosition = localToWorld(sofa, 0, 0.45);

    drawRectangle({
        width: 1.6,
        height: 0.3,
        x: backPosition.x,
        y: backPosition.y,
        rotation: sofa.rotation,
        scaleX: sofa.scaleX,
        scaleY: sofa.scaleY,
        color: {
            r: 0.45,
            g: 0.25,
            b: 0.15,
            a: 1.0
        }
    });

    // left arm
    const leftArmPosition = localToWorld(sofa, -0.7, 0.1);

    drawRectangle({
        width: 0.2,
        height: 1,
        x: leftArmPosition.x,
        y: leftArmPosition.y,
        rotation: sofa.rotation,
        scaleX: sofa.scaleX,
        scaleY: sofa.scaleY,
        color: {
            r: 0.45,
            g: 0.25,
            b: 0.15,
            a: 1.0
        }
    });

    // right arm
    const rightArmPosition = localToWorld(sofa, 0.7, 0.1);

    drawRectangle({
        width: 0.2,
        height: 1,
        x: rightArmPosition.x,
        y: rightArmPosition.y,
        rotation: sofa.rotation,
        scaleX: sofa.scaleX,
        scaleY: sofa.scaleY,
        color: {
            r: 0.45,
            g: 0.25,
            b: 0.15,
            a: 1.0
        }
    });
}


function drawDiningTable(table) {

    // tabletop
    drawRectangle({
        width: 1.4,
        height: 0.8,
        x: table.x,
        y: table.y,
        rotation: table.rotation,
        scaleX: table.scaleX,
        scaleY: table.scaleY,
        color: {
            r: 0.6,
            g: 0.4,
            b: 0.2,
            a: 1.0
        }
    });

    // top chair
const topChair = localToWorld(table, 0, 0.55);

drawRectangle({
    width: 0.35,
    height: 0.3,
    x: topChair.x,
    y: topChair.y,
    rotation: table.rotation,
    scaleX: table.scaleX,
    scaleY: table.scaleY,
    color: {
        r: 0.4,
        g: 0.25,
        b: 0.1,
        a: 1.0
    }
});

const bottomChair = localToWorld(table, 0, -0.55);

drawRectangle({
    width: 0.35,
    height: 0.3,
    x: bottomChair.x,
    y: bottomChair.y,
    rotation: table.rotation,
    scaleX: table.scaleX,
    scaleY: table.scaleY,
    color: {
        r: 0.4,
        g: 0.25,
        b: 0.1,
        a: 1.0
    }
});

const leftChair = localToWorld(table, -0.85, 0);

drawRectangle({
    width: 0.3,
    height: 0.35,
    x: leftChair.x,
    y: leftChair.y,
    rotation: table.rotation,
    scaleX: table.scaleX,
    scaleY: table.scaleY,
    color: {
        r: 0.4,
        g: 0.25,
        b: 0.1,
        a: 1.0
    }
});

const rightChair = localToWorld(table, 0.85, 0);

drawRectangle({
    width: 0.3,
    height: 0.35,
    x: rightChair.x,
    y: rightChair.y,
    rotation: table.rotation,
    scaleX: table.scaleX,
    scaleY: table.scaleY,
    color: {
        r: 0.4,
        g: 0.25,
        b: 0.1,
        a: 1.0
    }
});
}


function drawCoffeeTable(table) {
    const positions = createCircle(0.5);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const matrix = mat4.create();
    mat4.translate(matrix, matrix, [table.x, table.y, 0]);
    mat4.rotateZ(matrix, matrix, table.rotation);
    mat4.scale(matrix, matrix, [table.scaleX, table.scaleY, 1]);

    gl.uniformMatrix4fv(matrixLocation, false, matrix);
    gl.uniform4f(colorLocation, 0.5, 0.3, 0.15, 1.0);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, positions.length / 2);
}

function drawSectional(sectional) {

    // horizontal section
    drawRectangle({
        width: 1.5,
        height: 0.38,
        x: sectional.x,
        y: sectional.y,
        rotation: sectional.rotation,
        scaleX: sectional.scaleX,
        scaleY: sectional.scaleY,
        color: {
            r: 0.35,
            g: 0.45,
            b: 0.55,
            a: 1.0
        }
    });

    // vertical section
    const verticalPosition = localToWorld(sectional, 0.55, 0.6);

    drawRectangle({
        width: 0.4,
        height: 1.5,
        x: verticalPosition.x,
        y: verticalPosition.y,
        rotation: sectional.rotation,
        scaleX: sectional.scaleX,
        scaleY: sectional.scaleY,
        color: {
            r: 0.35,
            g: 0.45,
            b: 0.55,
            a: 1.0
        }
    });
}

function drawDoorway(door) {

    // arc
    drawArc(
        door.radius,
        door.x,
        door.y,
        door.rotation,
        door.swingAngle,
        Number.isFinite(door.scaleX) ? door.scaleX : 1,
        Number.isFinite(door.scaleY) ? door.scaleY : 1,
        {
            r: 0.2,
            g: 0.2,
            b: 0.2,
            a: 1.0
        }
    );

    // hinge
    const hinge = localToWorld(door, 0, 0);

    // end of arc
    const doorEnd = localToWorld(
        door,
        door.radius * Math.cos(door.swingAngle),
        door.radius * Math.sin(door.swingAngle)
    );

    // door leaf
    drawLine(
        hinge.x,
        hinge.y,
        doorEnd.x,
        doorEnd.y,
        {
            r: 0.2,
            g: 0.2,
            b: 0.2,
            a: 1.0
        }
    );
}

function drawRoom() {
    const wallColor = {
        r: 0.1,
        g: 0.1,
        b: 0.1,
        a: 1
    };

    // outer walls
    drawLine(-4, -4, 4, -4, wallColor);
    drawLine(-4, 4, 4, 4, wallColor);
    drawLine(-4, -4, -4, 4, wallColor);
    drawLine(4, -4, 4, 4, wallColor);

    // bathroom boundary at the top-right
    drawLine(1, 2, 1, 4, wallColor);
    drawLine(1, 2, 4, 2, wallColor);

    // bedroom boundary at the bottom-right
    drawLine(1, -4, 1, -1, wallColor);

    // short entry-hall boundary
    drawLine(1, -1, 2.5, -1, wallColor);
}


// just hardcoded calculations
function getObjectSize(object) {
        // this is the crude mathematical pickng border, not a gpu rendered shape
    const rectangles = {
        bed: [
            { x: 0, y: 0, width: 1.0, height: 1.6 },
            { x: -0.24, y: 0.67, width: 0.45, height: 0.3 },
            { x: 0.24, y: 0.67, width: 0.45, height: 0.3 },
            { x: 0, y: -0.4, width: 1.0, height: 0.8 }
        ],
        sofa: [
            { x: 0, y: 0, width: 1.6, height: 0.7 },
            { x: 0, y: 0.45, width: 1.6, height: 0.3 },
            { x: -0.7, y: 0.1, width: 0.2, height: 1.0 },
            { x: 0.7, y: 0.1, width: 0.2, height: 1.0 }
        ],
        diningTable: [
            { x: 0, y: 0, width: 1.4, height: 0.8 },
            { x: 0, y: 0.55, width: 0.35, height: 0.3 },
            { x: 0, y: -0.55, width: 0.35, height: 0.3 },
            { x: -0.85, y: 0, width: 0.3, height: 0.35 },
            { x: 0.85, y: 0, width: 0.3, height: 0.35 }
        ],
        coffeeTable: [
            { x: 0, y: 0, width: 1.0, height: 1.0 }
        ],
        sectional: [
            { x: 0, y: 0, width: 1.5, height: 0.38 },
            { x: 0.55, y: 0.6, width: 0.4, height: 1.5 }
        ]
    }[object.type];

    let points;

    if (object.type === "door") {
        points = [{ x: 0, y: 0 }];
        for (let i = 0; i <= 24; i++) {
            const angle = object.swingAngle * i / 24;
            points.push({
                x: object.radius * Math.cos(angle),
                y: object.radius * Math.sin(angle)
            });
        }
    } else if (rectangles) {
        points = rectangles.flatMap(rectangle => {
            const halfWidth = rectangle.width / 2;
            const halfHeight = rectangle.height / 2;

            return [
                { x: rectangle.x - halfWidth, y: rectangle.y - halfHeight },
                { x: rectangle.x + halfWidth, y: rectangle.y - halfHeight },
                { x: rectangle.x - halfWidth, y: rectangle.y + halfHeight },
                { x: rectangle.x + halfWidth, y: rectangle.y + halfHeight }
            ];
        });
    } else {
        return null;
    }

    const scaleX = Number.isFinite(object.scaleX) ? object.scaleX : 1;
    const scaleY = Number.isFinite(object.scaleY) ? object.scaleY : 1;
    const cos = Math.cos(object.rotation ?? 0);
    const sin = Math.sin(object.rotation ?? 0);
    const worldPoints = points.map(point => {
        const scaledX = point.x * scaleX;
        const scaledY = point.y * scaleY;

        return {
            x: object.x + cos * scaledX - sin * scaledY,
            y: object.y + sin * scaledX + cos * scaledY
        };
    });

    const xs = worldPoints.map(point => point.x);
    const ys = worldPoints.map(point => point.y);
    const left = Math.min(...xs);
    const right = Math.max(...xs);
    const bottom = Math.min(...ys);
    const top = Math.max(...ys);

    return {
        left:  left,
        right:  right,
        bottom:  bottom,
        top:  top,
        width: (right - left) + (object.type === "door" ? 0.3 : 0),
        height: (top - bottom) + (object.type === "door" ? 0.3 : 0)
    };
}

function updateObjectInfo() {
    if (!selectedObject) {
        selectionText.textContent = "No object selected";
        labelInput.value = "";
        assignLabelButton.disabled = true;
        return;
    }

    const scaleX = Number.isFinite(selectedObject.scaleX) ? selectedObject.scaleX : 1;

    selectionText.innerHTML = `
        <strong>Selected:</strong> ${selectedObject.label || selectedObject.type}<br>
        Position: (${selectedObject.x.toFixed(2)}, ${selectedObject.y.toFixed(2)})<br>
        Rotation: ${(selectedObject.rotation * 180 / Math.PI).toFixed(0)}°<br>
        Scale: ${scaleX.toFixed(2)}
    `;

    labelInput.value = selectedObject.label || selectedObject.type;
    assignLabelButton.disabled = currentMode !== "plan";
}

function keepInsideRoom(object) {
    const bounds = getObjectSize(object);

    if (bounds.left < -4) {
        object.x += -4 - bounds.left;
    }
    if (bounds.right > 4) {
        object.x -= bounds.right - 4;
    }
    if (bounds.bottom < -4) {
        object.y += -4 - bounds.bottom;
    }
    if (bounds.top > 4) {
        object.y -= bounds.top - 4;
    }
}


const bed = {
    type: "bed",
    x: 2.5,
    y: -2.5,
    rotation: 0,
    scaleX: 0.75,
    scaleY: 0.75
};

// drawbed(bed);



const sofa = {
    type: "sofa",
    x: -2.0,
    y: -2.5,
    rotation: 0,
    scaleX: 0.75,
    scaleY: 0.75
};

// drawsofa(sofa);

const diningTable = {
    type: "diningTable",
    x: -2.3,
    y: 2.5,
    rotation: 0,
    scaleX: 0.7,
    scaleY: 0.7
};

// drawdiningtable(diningtable);

const coffeeTable = {
    type: "coffeeTable",
    x: -1.5,
    y: -1.5,
    rotation: 0,
    scaleX: 0.7,
    scaleY: 0.7
};

// drawcoffeetable(coffeetable);

const sectional = {
    type: "sectional",
    x: -2.3,
    y: -1.2,
    rotation: Math.PI,
    scaleX: 0.75,
    scaleY: 0.75
};

// drawsectional(sectional);

const door = {
    type: "door",
    x: 1.0,
    y: -0.8,
    rotation: Math.PI / 2,
    scaleX: 1,
    scaleY: 1,
    radius: 0.8,
    swingAngle: Math.PI / 2.3
};

// drawdoorway(door);


const furniture = [
    bed,
    sofa,
    diningTable,
    coffeeTable,
    sectional,
    door
];

furniture.forEach(object => {
    object.label = object.label || object.type;
});

function createObject(type) {
    const object = {
        type,
        label: type,
        x: 0,
        y: 0,
        rotation: 0,
        scaleX: 0.7,
        scaleY: 0.7
    };

    if (type === "door") {
        object.radius = 1.2;
        object.swingAngle = Math.PI / 2.3;
        object.scaleX = 1;
        object.scaleY = 1;
    }

    return object;
}

function refreshSavedPlans() {
    const plans = JSON.parse(localStorage.getItem("furniturePlans") || "{}");
    savedPlans.innerHTML = '<option value="">Choose saved plan</option>';

    Object.keys(plans).forEach(name => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        savedPlans.append(option);
    });
}

function saveCurrentPlan() {
    const name = planName.value.trim() || `Plan ${Date.now()}`;
    const plans = JSON.parse(localStorage.getItem("furniturePlans") || "{}");
    plans[name] = JSON.parse(JSON.stringify(furniture));
    localStorage.setItem("furniturePlans", JSON.stringify(plans));
    refreshSavedPlans();
    savedPlans.value = name;
}

function loadSelectedPlan() {
    const name = savedPlans.value;
    if (!name) return;

    const plans = JSON.parse(localStorage.getItem("furniturePlans") || "{}");
    furniture.splice(0, furniture.length, ...plans[name]);
    selectedObject = null;
    updateObjectInfo();
    drawScene();
}

function randomizeLayout() {
    furniture.forEach(object => {
        object.x = Math.random() * 6 - 3;
        object.y = Math.random() * 6 - 3;
        object.rotation = Math.random() * Math.PI * 2;
        keepInsideRoom(object);
    });

    drawScene();
    updateObjectInfo();
}

function updateMode() {
    currentMode = modeSelect.value;
    const planning = currentMode === "plan";
    planName.disabled = currentMode !== "save";
    savePlanButton.disabled = currentMode !== "save";
    savedPlans.disabled = currentMode !== "retrieve";
    loadPlanButton.disabled = currentMode !== "retrieve";
    document.querySelectorAll("#spawnPanel button").forEach(button => {
        button.disabled = !planning;
    });
    randomizeButton.disabled = !planning;
    assignLabelButton.disabled = !planning || !selectedObject;
}

document.querySelectorAll("#spawnPanel button").forEach(button => {
    button.addEventListener("click", () => {
        const object = createObject(button.dataset.type);
        furniture.push(object);
        keepInsideRoom(object);
        selectedObject = object;
        updateObjectInfo();
        drawScene();
    });
});

modeSelect.addEventListener("change", updateMode);
savePlanButton.addEventListener("click", saveCurrentPlan);
loadPlanButton.addEventListener("click", loadSelectedPlan);
randomizeButton.addEventListener("click", randomizeLayout);
assignLabelButton.addEventListener("click", () => {
    if (!selectedObject || currentMode !== "plan") return;
    selectedObject.label = labelInput.value.trim() || selectedObject.type;
    updateObjectInfo();
});
refreshSavedPlans();
updateMode();

function drawScene() {
        // every redraw clears the old pixels and renders the complete current state
    gl.clear(gl.COLOR_BUFFER_BIT);

    drawRoom();


    furniture.forEach(object => {
        switch (object.type) {
            case "bed":
                drawBed(object);
                break;

            case "sofa":
                drawSofa(object);
                break;

            case "diningTable":
                drawDiningTable(object);
                break;

            case "coffeeTable":
                drawCoffeeTable(object);
                break;

            case "sectional":
                drawSectional(object);
                break;

            case "door":
                drawDoorway(object);
                break;
        }
    });

    if (hitboxesVisible) {
        drawHitboxes();
    }

    if (isDragging && selectedObject) {
        drawHitbox(selectedObject, { r: 1, g: 0.8, b: 0, a: 1 });
    }
}

function drawHitbox(object, color) {
    const bounds = getObjectSize(object);

    drawLine(bounds.left, bounds.bottom, bounds.right, bounds.bottom, color);
    drawLine(bounds.right, bounds.bottom, bounds.right, bounds.top, color);
    drawLine(bounds.right, bounds.top, bounds.left, bounds.top, color);
    drawLine(bounds.left, bounds.top, bounds.left, bounds.bottom, color);
}

function drawHitboxes() {
    furniture.forEach(object => {
        drawHitbox(object, { r: 1, g: 0, b: 0, a: 1 });
    });
}

function toggleHitboxes() {
    hitboxesVisible = !hitboxesVisible;
    hitboxToggle.textContent = hitboxesVisible ? "Hide hitboxes" : "Show hitboxes";
    drawScene();
}

hitboxToggle.addEventListener("click", toggleHitboxes);

drawScene();
updateObjectInfo();

canvas.addEventListener("mousedown", event => {
    if (currentMode !== "plan") return;

    const mouse = mouseToWorld(event);

    selectedObject = null;

    for (const object of furniture) {
        const size = getObjectSize(object);

        if (isPointInsideObject(mouse.x, mouse.y, size)) {
            selectedObject = object;
            updateObjectInfo();


            dragOffset.x = mouse.x - object.x;
            dragOffset.y = mouse.y - object.y;
            isDragging = true;
            console.log("Selected:", object.type);
            drawScene();
            break;
        }
    }
});

canvas.addEventListener("mousemove", event => {
    if (!isDragging || !selectedObject) return;

    const mouse = mouseToWorld(event);

    selectedObject.x = mouse.x - dragOffset.x;
    selectedObject.y = mouse.y - dragOffset.y;
    keepInsideRoom(selectedObject);

    drawScene();
    updateObjectInfo();
});

window.addEventListener("mouseup", () => {
    if (!isDragging) return;

    isDragging = false;
    drawScene();
});

window.addEventListener("keydown", event => {
    if (event.key.toLowerCase() === "l" && currentMode === "plan") {
        randomizeLayout();
        return;
    }

    if (!selectedObject || currentMode !== "plan") return;

    const scaleX = Number.isFinite(selectedObject.scaleX) ? selectedObject.scaleX : 1;
    const scaleY = Number.isFinite(selectedObject.scaleY) ? selectedObject.scaleY : 1;

    if (event.key.toLowerCase() === "r") {
        selectedObject.rotation += Math.PI / 12;
    }

    if (event.code === "Equal") {
        selectedObject.scaleX = scaleX + 0.1;
        selectedObject.scaleY = scaleY + 0.1;
    }

    if (event.code === "Minus") {
        selectedObject.scaleX = Math.max(0.1, scaleX - 0.1);
        selectedObject.scaleY = Math.max(0.1, scaleY - 0.1);
    }

    drawScene();
    updateObjectInfo();
});

//below is non matrix method..

// const positions = new float32array([
//     -0.5 + objectx, 0.5 + objecty,
//     0.5 + objectx, 0.5 + objecty,
//     -0.5 + objectx, -0.5 + objecty,

//     0.5 + objectx, 0.5 + objecty,
//     0.5 + objectx, -0.5 + objecty,
//     -0.5 + objectx, -0.5 + objecty
// ]);
// pworld = (txrxs)plocal
// t = [ 1 0 x
//     0 1 y
//     0 0 1
// ]


// is the 2d translation matrix

// const translation = translationmatrix(objectx, objecty);
// const rotation = rotationmatrix(angle);
// mat4.scale(matrix, matrix, [bed.scalex, bed.scaley, 1]);
// mat4.translate(matrix, matrix, [bed.x, bed.y, 0]);
// mat4.rotatez(matrix, matrix, bed.rotation);
// gl.uniformmatrix4fv(matrixlocation, false, matrix); // which uniform, transpose?, what matrix

// const positions = createrectangle(1.0, 1.0);

// upload it to the buffer
// gl.bufferdata(
//     gl.array_buffer,
//     positions,
//     gl.static_draw
// );



// gl.drawarrays(gl.triangles, 0, 6);
//gl.points means draw the vertices as points, start at vertex 0 and then draw 1 vertex



