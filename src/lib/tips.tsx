// The "?" texts for the questions that are built into the fire finder (not from Strapi).
// Questions from Strapi use their own extraDescription.

// Address and Postcode share one text: both tell us where the home is
const location = (
    <>
        Sets your <b>climate zone</b>, which sets how many m² 1 kW can heat, and
        checks <b>local rules</b>, e.g. Clean Air Zones where wood fires must be
        ULEB-listed.
    </>
);

export const TIPS = {
    address: location,
    postcode: location,
    propertySize: (
        <>
            Your whole property: the land your home is on, not just the house. A{" "}
            <b>hectare</b> is 10,000 m², about the size of a rugby field. Wood
            fire rules often differ by property size, e.g. many towns' emission
            rules only apply to properties under 2 hectares.
        </>
    ),
    share: (
        <>
            How much of the room’s heating should the fireplace do? At 100% it’s
            your only heat source, so it’s sized for the room’s full{" "}
            <b>heat requirement (kW)</b>. With other heat sources too, like a
            heat pump, it only has to cover its share. At 0% it’s just for
            ambience, and heat output doesn’t matter.
        </>
    ),
    area: (
        <>
            The area to heat sets the <b>heat output (kW)</b> you need. A bigger
            area needs a more powerful fire. Count the floor area of the room
            plus any space that stays open to it, like an open-plan kitchen or
            hallway.
        </>
    ),
};

/** The line under the two bars in step 2 */
export function shareHelp(share: number) {
    if (share <= 0) return "The fireplace is only for ambience, not heat.";
    if (share >= 100) return "The fireplace is the only heat source.";
    return `The fireplace has to deliver ${share}% of the heating.`;
}
