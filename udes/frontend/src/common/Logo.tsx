type logoProps = {
    set_classname: string
}

export default function Logo({set_classname}: logoProps){

    return(
        <>
            <div className="flex flex-row gap-2">
                <div>
                    <picture>
                        <img src={`${import.meta.env.BASE_URL}logo_1.png`} alt="Umbrella Logo" className={set_classname}/>
                    </picture>
                </div>
            </div>
        </>
    );
}
