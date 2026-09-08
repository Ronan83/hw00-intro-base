#version 300 es

// This is a fragment shader. If you've opened this file first, please
// open and read lambert.vert.glsl before reading on.
// Unlike the vertex shader, the fragment shader actually does compute
// the shading of geometry. For every pixel in your program's output
// screen, the fragment shader is run for every bit of geometry that
// particular pixel overlaps. By implicitly interpolating the position
// data passed into the fragment shader by the vertex shader, the fragment shader
// can compute what color to apply to its pixel based on things like vertex
// position, light position, and vertex color.
precision highp float;

uniform vec4 u_Color; // The color with which to render this instance of geometry.
uniform float u_Time;

// These are the interpolated values out of the rasterizer, so you can't know
// their specific values without knowing the vertices that contributed to them
in vec4 fs_Nor;
in vec4 fs_LightVec;
in vec4 fs_Col;
in vec4 fs_Pos;

out vec4 out_Col; // This is the final output color that you will see on your
                  // screen for the pixel that is currently being processed.

// ---------- 3D Perlin Noise ----------
// This follows the structure of Perlin's 2002 "Improved Noise" reference
// implementation: compute each corner's influence as a plain dot product,
// then blend the eight results with trilinear interpolation using the fade
// curve. The alternative surflet formulation folds that same falloff into
// each corner term and sums them directly; the two produce equivalent fields.

// Hash a 3D lattice point into a pseudo-random unit gradient vector.
vec3 random3(vec3 p) {
    return normalize(2.0 * fract(sin(vec3(
        dot(p, vec3(127.1, 311.7, 74.7)),
        dot(p, vec3(269.5, 183.3, 246.1)),
        dot(p, vec3(113.5, 271.9, 124.6))
    )) * 43758.5453) - 1.0);
}

// Perlin's improved fade curve: 6t^5 - 15t^4 + 10t^3.
// Its first and second derivatives both vanish at 0 and 1, so the noise
// stays smooth across lattice boundaries instead of showing grid creases.
vec3 fade(vec3 t) {
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

// How strongly one lattice corner pulls the sample point up or down:
// the dot product of that corner's gradient with the vector from the
// corner to the point. Positive means the point lies "uphill" from the
// corner along its gradient.
float influence(vec3 p, vec3 gridPoint) {
    vec3 gradient = random3(gridPoint);
    vec3 diff = p - gridPoint;
    return dot(gradient, diff);
}

float perlin3D(vec3 p) {
    vec3 base = floor(p);
    vec3 f = fract(p);
    vec3 u = fade(f);

    // Influence values from all 8 corners of the surrounding unit cube.
    float n000 = influence(p, base + vec3(0.0, 0.0, 0.0));
    float n100 = influence(p, base + vec3(1.0, 0.0, 0.0));
    float n010 = influence(p, base + vec3(0.0, 1.0, 0.0));
    float n110 = influence(p, base + vec3(1.0, 1.0, 0.0));
    float n001 = influence(p, base + vec3(0.0, 0.0, 1.0));
    float n101 = influence(p, base + vec3(1.0, 0.0, 1.0));
    float n011 = influence(p, base + vec3(0.0, 1.0, 1.0));
    float n111 = influence(p, base + vec3(1.0, 1.0, 1.0));

    // Trilinear interpolation, one axis at a time: 4 blends along x,
    // then 2 along y, then 1 along z. Each round halves the number of
    // values, like a tournament bracket collapsing 8 entrants to 1.
    float nx00 = mix(n000, n100, u.x);
    float nx10 = mix(n010, n110, u.x);
    float nx01 = mix(n001, n101, u.x);
    float nx11 = mix(n011, n111, u.x);

    float nxy0 = mix(nx00, nx10, u.y);
    float nxy1 = mix(nx01, nx11, u.y);

    return mix(nxy0, nxy1, u.z);
}

// Fractal Brownian motion: stack several octaves of Perlin noise, each at
// double the frequency and half the amplitude of the one before. Dividing
// by the summed amplitude keeps the result in roughly the same range
// regardless of how many octaves are used.
float fbm(vec3 p, int octaves) {
    float sum = 0.0;
    float amp = 1.0;
    float freq = 1.0;
    float norm = 0.0;
    for (int i = 0; i < 8; ++i) {
        if (i >= octaves) break;
        sum += amp * perlin3D(p * freq);
        norm += amp;
        amp *= 0.5;
        freq *= 2.0;
    }
    return sum / norm;
}

// Inigo Quilez's cubic pulse: a cheap bell curve.
// c is the center, w the half-width. Returns 0 outside [c-w, c+w].
float cubicPulse(float c, float w, float x) {
    x = abs(x - c);
    if (x > w) return 0.0;
    x /= w;
    return 1.0 - x * x * (3.0 - 2.0 * x);
}

void main()
{
    // Material base color (before shading)

                vec3 p = fs_Pos.xyz;
        float t = u_Time * 0.01;

        // Differential rotation: bands near the equator drift faster than
        // those near the poles, the way Jupiter's atmosphere actually behaves.
        float latitude = p.y;
        float driftSpeed = mix(1.0, 0.3, abs(latitude));
        vec3 flow = p + vec3(t * driftSpeed, 0.0, 0.0);

        // Turbulence field that bends the latitude bands.
        float turb = fbm(flow * 1.5 + vec3(0.0, 0.0, 3.7), 4);

        // Latitude bands: a sine along y, warped by the turbulence.
        // At turbStrength 0 these are straight stripes; raising it
        // swirls them into storm-like ribbons.
        float bandFreq = 7.0;
        float turbStrength = 1.2;
        float bands = sin(p.y * bandFreq + turb * turbStrength);
        bands = bands * 0.5 + 0.5;


        vec3 darkBand  = u_Color.rgb * 0.45;
        vec3 lightBand = mix(u_Color.rgb, vec3(1.0), 0.55);
        vec3 accent    = mix(u_Color.rgb, vec3(1.0), 0.8);

        vec3 col = mix(darkBand, lightBand, smoothstep(0.25, 0.75, bands));
        col = mix(col, accent, smoothstep(0.85, 1.0, bands));

        

        vec4 diffuseColor = vec4(col, 1.0);

        // Calculate the diffuse term for Lambert shading
        float diffuseTerm = dot(normalize(fs_Nor), normalize(fs_LightVec));
        // Avoid negative lighting values
        diffuseTerm = diffuseTerm * 0.5 + 0.5;

        float ambientTerm = 0.2;

        float lightIntensity = diffuseTerm + ambientTerm;   //Add a small float value to the color multiplier
                                                            //to simulate ambient lighting. This ensures that faces that are not
                                                            //lit by our point light are not completely black.

        // Compute final shaded color
        out_Col = vec4(diffuseColor.rgb * lightIntensity, diffuseColor.a);
}
